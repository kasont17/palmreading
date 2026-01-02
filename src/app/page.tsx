"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import Image from "next/image";
import {
  RotateCcw,
  Download,
  History,
  Trash2,
} from "lucide-react";
import html2canvas from "html2canvas";

interface PalmReading {
  heartLine?: { observation: string; meaning: string };
  headLine?: { observation: string; meaning: string };
  lifeLine?: { observation: string; meaning: string };
  fateLine?: { observation: string; meaning: string } | null;
  overallReading: string;
  advice: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SavedReading {
  id: string;
  date: string;
  reading: PalmReading;
  image: string;
  dominantHand: "left" | "right" | null;
}

type AppState = "welcome" | "capture" | "analyzing" | "reading" | "chat" | "archive";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [reading, setReading] = useState<PalmReading | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dominantHand, setDominantHand] = useState<"left" | "right" | null>(
    null
  );
  const [focusArea, setFocusArea] = useState("");
  const [captureStep, setCaptureStep] = useState<1 | 2>(1);
  const [archive, setArchive] = useState<SavedReading[]>([]);

  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load Archive on mount
  useEffect(() => {
    const saved = localStorage.getItem("palm_archive");
    if (saved) {
      try {
        setArchive(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse archive", e);
      }
    }
  }, []);

  useEffect(() => {
    if (appState === "chat") {
      scrollToBottom();
    }
  }, [chatMessages, isLoading, appState, scrollToBottom]);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setIsWebcamActive(false);
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        setIsWebcamActive(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveReadingToArchive = (newReading: PalmReading, image: string) => {
    const savedEntry: SavedReading = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      reading: newReading,
      image: image,
      dominantHand: dominantHand,
    };
    const updatedArchive = [savedEntry, ...archive];
    setArchive(updatedArchive);
    localStorage.setItem("palm_archive", JSON.stringify(updatedArchive));
  };

  const deleteFromArchive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedArchive = archive.filter(item => item.id !== id);
    setArchive(updatedArchive);
    localStorage.setItem("palm_archive", JSON.stringify(updatedArchive));
  };

  const analyzeHand = async () => {
    if (!capturedImage) return;

    setAppState("analyzing");
    setIsLoading(true);

    try {
      const response = await fetch("/api/read-palm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: capturedImage,
          dominantHand,
          focusArea,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to analyze palm");
      }

      setReading(data);
      saveReadingToArchive(data, capturedImage);
      setAppState("reading");
    } catch (error: any) {
      console.error("Error analyzing palm:", error);
      alert(error.message || "The Oracle is having trouble seeing clearly. Please try again with a clearer photo.");
      setAppState("capture");
    } finally {
      setIsLoading(false);
    }
  };

  const saveAsImage = async () => {
    if (!readingRef.current) return;
    
    try {
      const canvas = await html2canvas(readingRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `palm-reading-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Failed to save image:", error);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !reading) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          reading,
          chatHistory: chatMessages,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "The Oracle is silent. Please check your connection.");
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch (error: any) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: error.message || "Forgive me, but the spirits are clouding my vision. Please try again in a moment." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const startOver = () => {
    setAppState("welcome");
    setCapturedImage(null);
    setIsWebcamActive(false);
    setReading(null);
    setChatMessages([]);
    setDominantHand(null);
    setFocusArea("");
    setCaptureStep(1);
  };

  const viewSavedReading = (saved: SavedReading) => {
    setReading(saved.reading);
    setCapturedImage(saved.image);
    setDominantHand(saved.dominantHand);
    setAppState("reading");
  };

  if (appState === "welcome") {
    return (
      <main 
        className="min-h-screen bg-[#c0c3c9] relative overflow-hidden font-geist-mono cursor-pointer flex flex-col items-center justify-center animate-fade-in"
        onClick={() => setAppState("capture")}
      >
        {/* Left Color Bars */}
        <div className="absolute h-[135.76px] left-0 top-1/2 -translate-y-1/2 w-[17.135px] hidden md:block">
          <div className="absolute bg-[#3854a4] h-[67.88px] left-0 top-0 w-[8.567px]" />
          <div className="absolute bg-[#6bbe45] h-[67.88px] left-0 top-[67.88px] w-[8.567px]" />
          <div className="absolute bg-[#6fccdd] h-[19.112px] left-[8.57px] top-[116.65px] w-[8.567px]" />
          <div className="absolute bg-[#ee2227] h-[19.112px] left-[8.57px] top-0 w-[8.567px]" />
        </div>

        {/* Right Color Bars */}
        <div className="absolute h-[135.76px] right-0 top-1/2 -translate-y-1/2 w-[17.135px] hidden md:block">
          <div className="h-full relative w-full rotate-180 scale-y-[-1]">
            <div className="absolute bg-[#f1ea18] h-[67.88px] left-0 top-0 w-[8.567px]" />
            <div className="absolute bg-[#bb519d] h-[67.88px] left-0 top-[67.88px] w-[8.567px]" />
            <div className="absolute bg-[#6bbe45] h-[19.112px] left-[8.57px] top-[116.65px] w-[8.567px]" />
            <div className="absolute bg-[#3854a4] h-[19.112px] left-[8.57px] top-0 w-[8.567px]" />
          </div>
        </div>

        <div className="relative flex flex-col items-center gap-4">
          <div className="w-[300px] md:w-[372px] flex justify-between items-center text-[12px] uppercase text-nowrap">
            <div className="flex gap-[6px] items-center">
              <p className="text-white">Palm Reading</p>
              <p className="text-white/40">circa. 2000</p>
            </div>
            {archive.length > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); setAppState("archive"); }}
                className="text-white/60 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <History className="w-3 h-3" />
                Archive
              </button>
            )}
          </div>

          <div className="w-[300px] h-[396px] md:w-[372px] md:h-[491px] flex items-center justify-center">
            <Image
              src="/machine-figma.png"
              alt="Bocca della Verità"
              width={372}
              height={491}
              className="object-contain drop-shadow-2xl animate-pulse"
              priority
            />
          </div>

          <div className="w-[300px] md:w-[372px] flex justify-end gap-[6px] items-center text-[12px] uppercase text-nowrap">
            <p className="text-white animate-pulse">PRESS TO START</p>
            <p className="text-white/40">_$0</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#c0c3c9] relative overflow-hidden font-geist-mono">
      {/* Capture State */}
      {appState === "capture" && (
        <div className="min-h-screen flex flex-col items-center justify-center animate-fade-in font-geist-mono p-4">
          <div className="absolute h-[135.76px] left-0 top-1/2 -translate-y-1/2 w-[17.135px] hidden md:block">
            <div className="absolute bg-[#3854a4] h-[67.88px] left-0 top-0 w-[8.567px]" />
            <div className="absolute bg-[#6bbe45] h-[67.88px] left-0 top-[67.88px] w-[8.567px]" />
            <div className="absolute bg-[#6fccdd] h-[19.112px] left-[8.57px] top-[116.65px] w-[8.567px]" />
            <div className="absolute bg-[#ee2227] h-[19.112px] left-[8.57px] top-0 w-[8.567px]" />
          </div>

          <div className="absolute h-[135.76px] right-0 top-1/2 -translate-y-1/2 w-[17.135px] hidden md:block">
            <div className="h-full relative w-full rotate-180 scale-y-[-1]">
              <div className="absolute bg-[#f1ea18] h-[67.88px] left-0 top-0 w-[8.567px]" />
              <div className="absolute bg-[#bb519d] h-[67.88px] left-0 top-[67.88px] w-[8.567px]" />
              <div className="absolute bg-[#6bbe45] h-[19.112px] left-[8.57px] top-[116.65px] w-[8.567px]" />
              <div className="absolute bg-[#3854a4] h-[19.112px] left-[8.57px] top-0 w-[8.567px]" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-10 w-full max-w-[366px]">
            <div className="flex items-center justify-between w-full">
              <button onClick={() => captureStep === 1 ? startOver() : setCaptureStep(1)} className="text-[12px] text-white uppercase hover:opacity-70 transition-opacity">
                {`< Back`}
              </button>
              <div className="w-[30px] h-[50px] relative">
                <Image src="/logo-small.svg" alt="Logo" fill className="object-contain" />
              </div>
              <div className="text-[12px] text-white uppercase">
                0{captureStep} / 02
              </div>
            </div>

            {captureStep === 1 ? (
              <>
                <div className="flex flex-col gap-7 items-center w-full">
                  <div 
                    className="border border-[#3854a4] h-[400px] w-full relative overflow-hidden bg-white/5 cursor-pointer flex items-center justify-center group"
                    onClick={() => !capturedImage && setIsWebcamActive(true)}
                  >
                    {!isWebcamActive && !capturedImage && (
                      <div className="text-center text-white text-[12px] uppercase leading-relaxed px-4 group-hover:scale-105 transition-transform">
                        <p>Click here to</p>
                        <p>take a picture</p>
                        <p>of your palm</p>
                      </div>
                    )}

                    {isWebcamActive && (
                      <div className="absolute inset-0">
                        <Webcam
                          ref={webcamRef}
                          audio={false}
                          screenshotFormat="image/jpeg"
                          className="w-full h-full object-cover"
                          videoConstraints={{ facingMode: "environment" }}
                        />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                          <button onClick={(e) => { e.stopPropagation(); capture(); }} className="bg-white text-[#3854a4] hover:bg-white/90 text-[10px] px-6 py-2 font-bold uppercase tracking-widest">
                            CAPTURE
                          </button>
                        </div>
                      </div>
                    )}

                    {capturedImage && !isWebcamActive && (
                      <div className="absolute inset-0">
                        <img src={capturedImage} alt="Captured palm" className="w-full h-full object-cover" />
                        <button onClick={(e) => { e.stopPropagation(); setCapturedImage(null); setIsWebcamActive(true); }} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button onClick={() => fileInputRef.current?.click()} className="text-[12px] text-center text-white uppercase hover:opacity-70 transition-opacity underline-offset-4 hover:underline">
                    UPLOAD IMAGE INSTEAD
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                </div>

                <button disabled={!capturedImage} onClick={() => setCaptureStep(2)} className="bg-[#3854a4] text-white text-[12px] font-bold uppercase py-6 px-10 w-full hover:bg-[#2d4383] disabled:opacity-50 disabled:cursor-not-allowed transition-colors tracking-widest">
                  NEXT
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-10 items-center w-full h-[400px] justify-center">
                  <div className="flex flex-col gap-5 items-center w-full">
                    <p className="text-[12px] text-white uppercase text-center">WHICH IS YOUR DOMINANT HAND?</p>
                    <div className="flex w-full">
                      <button onClick={() => setDominantHand("left")} className={`flex-1 py-6 border border-[#3854a4] text-[12px] uppercase transition-colors ${dominantHand === "left" ? "bg-[#3854a4] text-white" : "text-white hover:bg-white/5"}`}>LEFT</button>
                      <button onClick={() => setDominantHand("right")} className={`flex-1 py-6 border-y border-r border-[#3854a4] text-[12px] uppercase transition-colors ${dominantHand === "right" ? "bg-[#3854a4] text-white" : "text-white hover:bg-white/5"}`}>RIGHT</button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 items-center w-full">
                    <p className="text-[12px] text-white uppercase text-center leading-relaxed">What would you like insight on?<br/>(optional)</p>
                    <input type="text" placeholder="E.G., LOVE, CAREER, HEALTH.." value={focusArea} onChange={(e) => setFocusArea(e.target.value)} className="w-full bg-transparent border border-[#3854a4] py-6 px-4 text-[12px] text-white uppercase text-center focus:outline-none placeholder:text-white/20" />
                  </div>
                </div>

                <button disabled={!dominantHand || isLoading} onClick={analyzeHand} className="bg-[#3854a4] text-white text-[12px] font-bold uppercase py-6 px-10 w-full hover:bg-[#2d4383] disabled:opacity-50 disabled:cursor-not-allowed transition-colors tracking-widest">
                  {isLoading ? "Consulting..." : "REVEAL YOUR DESTINY"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Archive State */}
      {appState === "archive" && (
        <div className="min-h-screen flex flex-col items-center justify-center animate-fade-in font-geist-mono p-4">
          <div className="absolute h-[135.76px] left-0 top-1/2 -translate-y-1/2 w-[17.135px] hidden md:block">
            <div className="absolute bg-[#3854a4] h-[67.88px] left-0 top-0 w-[8.567px]" />
            <div className="absolute bg-[#6bbe45] h-[67.88px] left-0 top-[67.88px] w-[8.567px]" />
            <div className="absolute bg-[#6fccdd] h-[19.112px] left-[8.57px] top-[116.65px] w-[8.567px]" />
            <div className="absolute bg-[#ee2227] h-[19.112px] left-[8.57px] top-0 w-[8.567px]" />
          </div>

          <div className="absolute h-[135.76px] right-0 top-1/2 -translate-y-1/2 w-[17.135px] hidden md:block">
            <div className="h-full relative w-full rotate-180 scale-y-[-1]">
              <div className="absolute bg-[#f1ea18] h-[67.88px] left-0 top-0 w-[8.567px]" />
              <div className="absolute bg-[#bb519d] h-[67.88px] left-0 top-[67.88px] w-[8.567px]" />
              <div className="absolute bg-[#6bbe45] h-[19.112px] left-[8.57px] top-[116.65px] w-[8.567px]" />
              <div className="absolute bg-[#3854a4] h-[19.112px] left-[8.57px] top-0 w-[8.567px]" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-10 w-full max-w-[366px]">
            <div className="flex items-center justify-between w-full">
              <button onClick={startOver} className="text-[12px] text-white uppercase hover:opacity-70 transition-opacity">
                {`< Back`}
              </button>
              <div className="w-[30px] h-[50px] relative">
                <Image src="/logo-small.svg" alt="Logo" fill className="object-contain" />
              </div>
              <p className="text-[12px] text-white uppercase">Archive</p>
            </div>

            <div className="w-full flex flex-col gap-4 overflow-y-auto max-h-[400px] pr-2">
              {archive.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => viewSavedReading(item)}
                  className="bg-white/5 border border-white/10 p-4 flex gap-4 cursor-pointer hover:bg-white/10 transition-colors group relative"
                >
                  <div className="w-20 h-24 relative overflow-hidden bg-black">
                    <img src={item.image} alt="Palm" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-[10px] text-white/40 uppercase mb-1">{item.date}</p>
                    <p className="text-[12px] text-white uppercase font-bold line-clamp-2">{item.reading.overallReading}</p>
                    <p className="text-[10px] text-[#3854a4] uppercase mt-2">{item.dominantHand} hand</p>
                  </div>
                  <button 
                    onClick={(e) => deleteFromArchive(item.id, e)}
                    className="absolute top-2 right-2 p-2 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analyzing State */}
      {appState === "analyzing" && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 animate-fade-in">
          <div className="relative w-[300px] h-[396px] md:w-[372px] md:h-[491px]">
            <Image src="/machine-figma.png" alt="Bocca della Verità" fill className="object-contain drop-shadow-2xl animate-pulse" />
          </div>
          <div className="text-center font-geist-mono">
            <h2 className="text-2xl text-white mb-2 uppercase tracking-widest">THE ORACLE SPEAKS...</h2>
            <p className="text-white/60 uppercase text-sm">Reading the lines of your destiny...</p>
          </div>
        </div>
      )}

      {/* Reading State */}
      {appState === "reading" && reading && (
        <div className="min-h-screen flex flex-col items-center justify-center font-geist-mono p-4">
          <div className="flex flex-col items-center gap-6 w-full max-w-[400px]">
            <div className="flex items-center justify-between w-full animate-fade-in">
              <button onClick={() => archive.length > 0 ? setAppState("archive") : setAppState("capture")} className="text-[12px] text-white uppercase hover:opacity-70 transition-opacity">{`< Archive`}</button>
              <div className="w-[30px] h-[50px] relative">
                <Image src="/logo-small.svg" alt="Logo" fill className="object-contain" />
              </div>
              <button onClick={startOver} className="text-[12px] text-white uppercase hover:opacity-70 transition-opacity">Home</button>
            </div>

            <div className="w-full relative flex flex-col items-center">
              <div className="absolute top-0 w-[calc(100%+34px)] h-[12px] bg-[#5d5f64] rounded-full z-10 shadow-inner" />
              <div className="w-full overflow-hidden pt-[6px]">
                <div ref={readingRef} className="w-full bg-white shadow-2xl flex flex-col items-center py-10 px-6 animate-print relative z-20 overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-gray-200">
                  <div className="w-full flex flex-col gap-6 text-[#5d5f64] uppercase text-[12px] text-center">
                    <div className="flex flex-col gap-2">
                      <p className="text-[#c0c3c9]">#######################################</p>
                      <p className="font-bold tracking-widest">Your reading</p>
                      <p className="text-[#c0c3c9]">#######################################</p>
                    </div>

                    <div className="flex flex-col gap-6 text-left lowercase normal-case">
                      <div className="flex flex-col gap-1">
                        <p className="uppercase text-[10px] text-[#c0c3c9]">Overall</p>
                        <p className="leading-relaxed font-bold">{reading.overallReading}</p>
                      </div>

                      {reading.heartLine && (
                        <div className="flex flex-col gap-1">
                          <p className="uppercase text-[10px] text-[#c0c3c9]">Heart Line</p>
                          <p className="leading-relaxed italic text-[11px] text-[#c0c3c9]">{reading.heartLine.observation}</p>
                          <p className="leading-relaxed">{reading.heartLine.meaning}</p>
                        </div>
                      )}

                      {reading.headLine && (
                        <div className="flex flex-col gap-1">
                          <p className="uppercase text-[10px] text-[#c0c3c9]">Head Line</p>
                          <p className="leading-relaxed italic text-[11px] text-[#c0c3c9]">{reading.headLine.observation}</p>
                          <p className="leading-relaxed">{reading.headLine.meaning}</p>
                        </div>
                      )}

                      {reading.lifeLine && (
                        <div className="flex flex-col gap-1">
                          <p className="uppercase text-[10px] text-[#c0c3c9]">Life Line</p>
                          <p className="leading-relaxed italic text-[11px] text-[#c0c3c9]">{reading.lifeLine.observation}</p>
                          <p className="leading-relaxed">{reading.lifeLine.meaning}</p>
                        </div>
                      )}

                      {reading.fateLine && (
                        <div className="flex flex-col gap-1">
                          <p className="uppercase text-[10px] text-[#c0c3c9]">Fate Line</p>
                          <p className="leading-relaxed italic text-[11px] text-[#c0c3c9]">{reading.fateLine.observation}</p>
                          <p className="leading-relaxed">{reading.fateLine.meaning}</p>
                        </div>
                      )}

                      <div className="flex flex-col gap-1 border-t border-dashed border-[#c0c3c9] pt-4">
                        <p className="uppercase text-[10px] text-[#c0c3c9] text-center">Oracle&apos;s Wisdom</p>
                        <p className="text-center italic font-bold">{reading.advice}</p>
                      </div>
                    </div>

                    <p className="text-[#c0c3c9] mt-4">#######################################</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mt-4">
              <button 
                onClick={saveAsImage}
                className="bg-white text-[#3854a4] text-[12px] font-bold uppercase py-6 px-4 hover:bg-gray-100 transition-colors tracking-widest flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                SAVE
              </button>
              <button 
                onClick={() => setAppState("chat")}
                className="bg-[#3854a4] text-white text-[12px] font-bold uppercase py-6 px-4 hover:bg-[#2d4383] transition-colors tracking-widest"
              >
                ASK THE ORACLE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat State */}
      {appState === "chat" && reading && (
        <div className="min-h-screen flex flex-col items-center justify-center animate-fade-in font-geist-mono p-4">
          <div className="absolute h-[135.76px] left-0 top-1/2 -translate-y-1/2 w-[17.135px] hidden md:block">
            <div className="absolute bg-[#3854a4] h-[67.88px] left-0 top-0 w-[8.567px]" />
            <div className="absolute bg-[#6bbe45] h-[67.88px] left-0 top-[67.88px] w-[8.567px]" />
            <div className="absolute bg-[#6fccdd] h-[19.112px] left-[8.57px] top-[116.65px] w-[8.567px]" />
            <div className="absolute bg-[#ee2227] h-[19.112px] left-[8.57px] top-0 w-[8.567px]" />
          </div>

          <div className="absolute h-[135.76px] right-0 top-1/2 -translate-y-1/2 w-[17.135px] hidden md:block">
            <div className="h-full relative w-full rotate-180 scale-y-[-1]">
              <div className="absolute bg-[#f1ea18] h-[67.88px] left-0 top-0 w-[8.567px]" />
              <div className="absolute bg-[#bb519d] h-[67.88px] left-0 top-[67.88px] w-[8.567px]" />
              <div className="absolute bg-[#6bbe45] h-[19.112px] left-[8.57px] top-[116.65px] w-[8.567px]" />
              <div className="absolute bg-[#3854a4] h-[19.112px] left-[8.57px] top-0 w-[8.567px]" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-10 w-full max-w-[366px]">
            <div className="flex items-center justify-between w-full">
              <button onClick={() => setAppState("reading")} className="text-[12px] text-white uppercase hover:opacity-70 transition-opacity">{`< Reading`}</button>
              <div className="w-[30px] h-[50px] relative">
                <Image src="/logo-small.svg" alt="Logo" fill className="object-contain" />
              </div>
              <button onClick={startOver} className="text-[12px] text-white uppercase hover:opacity-70 transition-opacity">Home</button>
            </div>

            <div className="h-[400px] w-full overflow-y-auto flex flex-col gap-6 scrollbar-thin scrollbar-thumb-[#3854a4]/20 pr-2">
              {chatMessages.length === 0 && (
                <div className="bg-[#d9dbe1] p-3 text-[#3854a4] text-[14px] leading-tight max-w-[90%] self-start font-geist-mono italic">
                  The Oracle is listening. Ask about the lines of your palm...
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`p-3 text-[14px] leading-tight max-w-[90%] font-geist-mono ${msg.role === "user" ? "bg-[#5d5f64] text-white self-end text-right" : "bg-white text-[#3854a4] self-start border-l-4 border-[#3854a4]"}`}>
                  {msg.content}
                </div>
              ))}
              {isLoading && (
                <div className="bg-white/5 p-3 text-white/60 text-[12px] self-start font-geist-mono flex gap-1 items-center uppercase tracking-widest">
                  <span className="animate-pulse">The Oracle is consulting the stars</span>
                  <span className="flex gap-1 ml-2">
                    <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 bg-white rounded-full animate-bounce"></span>
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex flex-col gap-3 w-full">
              <div className="flex gap-3 w-full">
                <div className="flex-1 border border-[#3854a4] relative">
                  <input type="text" placeholder="ASK SOMETHING.." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !isLoading && sendChatMessage()} className="w-full bg-transparent p-6 text-[12px] text-white uppercase focus:outline-none placeholder:text-white/20" />
                </div>
                <button onClick={sendChatMessage} disabled={isLoading || !chatInput.trim()} className="bg-[#3854a4] text-white px-10 py-6 font-bold uppercase text-[12px] tracking-widest hover:bg-[#2d4383] transition-colors disabled:opacity-50">SEND</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
