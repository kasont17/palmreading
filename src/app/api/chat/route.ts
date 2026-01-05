import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Fallback mystical responses for when the API is down
function generateLocalChatResponse(message: string, reading: any) {
  const msg = message.toLowerCase();
  
  const responses = {
    career: [
      "The lines of your palm suggest a shift in your professional energy is approaching.",
      "Your head line indicates a sharp mind that will lead you to success if you trust your analytical gifts.",
      "The spirits see a path of growth where your unique talents will finally be recognized."
    ],
    love: [
      "Your heart line speaks of deep emotional potential and the beauty of connection.",
      "The mounts of your palm suggest that being open to vulnerability will bring the harmony you seek.",
      "A warm energy surrounds your emotional life—patience will reveal the true depth of your heart's journey."
    ],
    destiny: [
      "Destiny is not a fixed path, but a tapestry you weave with every choice.",
      "The cosmic energy around you is vibrant; the spirits are guiding you toward your true purpose.",
      "Your fate line, though subtle, shows a soul that is learning to command its own future."
    ],
    general: [
      "The Oracle hears your query, though the spirit realm is currently clouded with shadows.",
      "Trust in the wisdom already written in the lines of your palm.",
      "Seek the answers within; your heart already knows the truth you are searching for.",
      "The stars suggest that now is a time for reflection rather than action."
    ]
  };

  if (msg.includes("job") || msg.includes("career") || msg.includes("work") || msg.includes("money")) {
    return responses.career[Math.floor(Math.random() * responses.career.length)];
  } else if (msg.includes("love") || msg.includes("heart") || msg.includes("relationship") || msg.includes("marriage")) {
    return responses.love[Math.floor(Math.random() * responses.love.length)];
  } else if (msg.includes("fate") || msg.includes("destiny") || msg.includes("future") || msg.includes("life")) {
    return responses.destiny[Math.floor(Math.random() * responses.destiny.length)];
  } else {
    return responses.general[Math.floor(Math.random() * responses.general.length)];
  }
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  const body = await request.json();
  const { message, reading, chatHistory } = body;

  try {
    if (!message) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
      console.log("No API key, using local chat fallback");
      return NextResponse.json({ response: generateLocalChatResponse(message, reading) });
    }

    const systemPrompt = `You are a mystical palm reading oracle. You have just completed a reading for a seeker. 
Your personality: Wise, slightly cryptic but encouraging, and deeply spiritual. Use terms like "the lines of destiny", "the mounts of your palm", "the spirits", and "cosmic energy".

Here is the reading you provided:
- Heart Line: ${reading?.heartLine?.meaning || "Not analyzed"}
- Head Line: ${reading?.headLine?.meaning || "Not analyzed"}
- Life Line: ${reading?.lifeLine?.meaning || "Not analyzed"}
- Fate Line: ${reading?.fateLine?.meaning || "Not visible/analyzed"}
- Overall Reading: ${reading?.overallReading || "Not analyzed"}
- Initial Wisdom: ${reading?.advice || "Not analyzed"}

Keep your responses concise (2-4 sentences) unless specifically asked for more detail. Always maintain your mystical persona. Never break character.`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt
    });

    const history = (chatHistory || [])
      .map((msg: any) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

    const chatSession = model.startChat({
      history: history,
    });

    const result = await chatSession.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ response: text });

  } catch (error: any) {
    console.error("Chat error:", error);
    
    // Fallback to local response if API fails
    console.log("Using local chat fallback after error");
    return NextResponse.json({ 
      response: generateLocalChatResponse(message, reading) 
    });
  }
}
