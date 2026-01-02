import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Fallback reading generator for when API is unavailable
function generateLocalReading(dominantHand: string | null, focusArea: string | null) {
  const seed = Date.now();
  const pick = <T>(arr: T[]) => arr[seed % arr.length];
  const pick2 = <T>(arr: T[]) => arr[(seed >> 4) % arr.length];
  const pick3 = <T>(arr: T[]) => arr[(seed >> 8) % arr.length];

  const heartObservations = [
    "Your heart line curves gracefully upward, touching the base of your index finger",
    "A deep, clear heart line extends across your palm with gentle undulations",
    "Your heart line shows a slight fork at its end, branching toward wisdom",
    "The heart line on your palm runs long and unbroken, with subtle depth variations",
    "A beautifully curved heart line sweeps across your palm with quiet strength",
  ];

  const heartMeanings = [
    "You possess a deeply romantic nature and form lasting emotional bonds with those you love.",
    "Your emotional intelligence guides you through life's complexities with grace and understanding.",
    "You have the capacity for profound love, though you choose carefully where to place your heart.",
    "Your emotional world is rich and textured—you feel deeply and love with intention.",
    "You balance heart and mind beautifully, making decisions that honor both logic and feeling.",
  ];

  const headObservations = [
    "Your head line extends with clarity and purpose across the center of your palm",
    "A gently sloping head line indicates a blend of creative and analytical thinking",
    "The head line shows depth and consistency, curving slightly downward toward imagination",
    "Your head line begins strongly, showing independence of thought from an early age",
    "A long, clear head line stretches across your palm with remarkable definition",
  ];

  const headMeanings = [
    "You possess a sharp, analytical mind that can cut through confusion to find truth.",
    "Your thinking blends creativity with practicality—you dream big but plan wisely.",
    "Mental clarity is your gift; you see patterns others miss and connect disparate ideas.",
    "You think independently and aren't easily swayed by popular opinion or passing trends.",
    "Your intellectual curiosity knows no bounds—learning is a lifelong joy for you.",
  ];

  const lifeObservations = [
    "The life line sweeps in a wide arc around your thumb, full of vitality",
    "Your life line shows remarkable depth and clarity, curving with confidence",
    "A strong life line encircles the mount of Venus with steady determination",
    "The life line begins boldly and maintains its strength throughout its journey",
    "Your life line shows subtle variations that speak to meaningful life transitions",
  ];

  const lifeMeanings = [
    "You have abundant life energy and the resilience to overcome any challenge.",
    "Your vitality is strong—you bring enthusiasm and energy to everything you do.",
    "Major positive transitions await you; the universe is aligning opportunities on your path.",
    "You have deep reserves of strength that emerge precisely when you need them most.",
    "Your life force is vibrant; you inspire others simply by being authentically yourself.",
  ];

  const overallReadings = [
    `Your palm reveals a beautiful harmony between heart, mind, and spirit. The lines suggest someone who has walked through challenges with grace and emerged wiser. ${dominantHand === "left" ? "Your left hand shows the gifts you were born with—and they are considerable." : "Your right hand shows what you're actively creating—and it's remarkable."} A period of growth and fulfillment lies ahead.`,
    `The Oracle sees in your palm a soul on the cusp of transformation. Your lines speak of accumulated wisdom and untapped potential waiting to bloom. ${focusArea ? `In matters of ${focusArea}, the spirits whisper of positive change approaching.` : "Trust in the journey that unfolds before you."} The universe recognizes your efforts.`,
    `Your palm tells a story of resilience and hope. The major lines align in a pattern suggesting that past struggles are transforming into future strengths. ${dominantHand === "right" ? "Your active hand shows you're taking control of your destiny." : "Your receptive hand reveals deep intuitive gifts."} Beautiful chapters await.`,
    `The lines of your palm weave a tapestry of promise. Heart and head work in concert, guiding you toward meaningful experiences and genuine connections. ${focusArea ? `The energy around ${focusArea} is particularly bright in your reading.` : "All aspects of your life are moving toward balance."} Trust your inner compass.`,
    `Your palm radiates quiet strength and untold potential. The Oracle perceives a soul that has learned much and has even more to discover. ${dominantHand === "left" ? "Your innate talents are your greatest treasures." : "Your actions are shaping a future filled with purpose."} Walk forward with confidence.`,
  ];

  const adviceList = [
    "Trust your intuition—it has been sharpened by experience and will not lead you astray.",
    "The path ahead may seem unclear, but each step you take illuminates the next. Keep moving.",
    "Open your heart to new possibilities; the universe is preparing gifts you cannot yet imagine.",
    "Balance is your key to fulfillment—nurture both your ambitions and your need for peace.",
    "Your greatest strength lies in your authenticity. Never dim your light for others' comfort.",
    "The spirits remind you: what you seek is also seeking you. Remain open and patient.",
    "Release what no longer serves you; your hands are meant to receive new blessings.",
  ];

  return {
    heartLine: {
      observation: pick(heartObservations),
      meaning: pick2(heartMeanings),
    },
    headLine: {
      observation: pick(headObservations),
      meaning: pick2(headMeanings),
    },
    lifeLine: {
      observation: pick(lifeObservations),
      meaning: pick2(lifeMeanings),
    },
    fateLine: {
      observation: "A subtle fate line emerges from the base of your palm, suggesting destiny is actively unfolding.",
      meaning: "Your life's direction is becoming clearer; trust the path that reveals itself.",
    },
    overallReading: pick3(overallReadings),
    advice: pick(adviceList),
  };
}

async function callGeminiWithRetry(model: any, prompt: string, imageData: string, maxRetries = 2) {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData,
          },
        },
      ]);
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`Gemini API attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  
  throw lastError;
}

export async function POST(request: Request) {
  let dominantHand: string | null = null;
  let focusArea: string | null = null;

  try {
    const body = await request.json();
    const image = body.image;
    dominantHand = body.dominantHand;
    focusArea = body.focusArea;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
      console.log("No API key or default key, using local fallback");
      const reading = generateLocalReading(dominantHand, focusArea);
      return NextResponse.json(reading);
    }

    // Extract base64 data from data URL
    const base64Data = image.split(",")[1];

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    // Build the personalized prompt
    let personalContext = "";
    if (dominantHand) {
      personalContext += `The user's dominant hand is their ${dominantHand} hand. `;
      if (dominantHand === "right") {
        personalContext += "The right hand typically represents the present and future, showing what the person is actively creating in their life. ";
      } else {
        personalContext += "The left hand typically represents inherited traits and potential, showing the person's innate abilities and tendencies. ";
      }
    }
    if (focusArea) {
      personalContext += `The user is particularly interested in insights about: ${focusArea}. Please emphasize this aspect in your reading. `;
    }

    const prompt = `You are an expert palm reader (chiromancer) and mystical oracle. Analyze this palm image and provide a detailed reading.

${personalContext}

Analyze the following aspects of the palm:

1. **Major Lines**:
   - Heart Line: Emotional life, relationships, love
   - Head Line: Intellect, decision-making style, mental approach
   - Life Line: Vitality, major life changes, energy (NOT lifespan prediction)
   - Fate Line: Career path, life direction, destiny (if visible)

2. **Minor Lines** (if visible):
   - Sun Line: Success, fame, creativity
   - Mercury Line: Communication, business acumen

3. **Mounts** (raised areas of the palm):
   - Mount of Jupiter (under index finger): Ambition, leadership
   - Mount of Venus (base of thumb): Love, passion, vitality
   - Mount of Moon (outer edge): Imagination, intuition

For each line, describe:
- Specific observations about depth, length, curves, breaks, branches, and clarity
- The meaning of these observations

Respond ONLY with valid JSON in this exact format:
{
  "heartLine": {
    "observation": "string",
    "meaning": "string"
  },
  "headLine": {
    "observation": "string",
    "meaning": "string"
  },
  "lifeLine": {
    "observation": "string",
    "meaning": "string"
  },
  "fateLine": {
    "observation": "string or null",
    "meaning": "string or null"
  },
  "overallReading": "string (2-3 sentences)",
  "advice": "string (a piece of wisdom)"
}

Be mystical and engaging in your language while remaining insightful. Focus on positive interpretations and growth-oriented advice.`;

    const result = await callGeminiWithRetry(model, prompt, base64Data);

    const response = await result.response;
    const text = response.text();

    try {
      const reading = JSON.parse(text);
      return NextResponse.json(reading);
    } catch (parseError) {
      console.error("JSON parse error. Raw text:", text);
      // Fallback cleanup if JSON mode is not working as expected
      let cleanedText = text.trim();
      if (cleanedText.startsWith("```json")) cleanedText = cleanedText.slice(7);
      if (cleanedText.startsWith("```")) cleanedText = cleanedText.slice(3);
      if (cleanedText.endsWith("```")) cleanedText = cleanedText.slice(0, -3);
      cleanedText = cleanedText.trim();
      
      try {
        const reading = JSON.parse(cleanedText);
        return NextResponse.json(reading);
      } catch (secondParseError) {
        return NextResponse.json(
          { error: "Failed to parse oracle's response", details: text },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error("Palm reading error:", error);
    
    // Use local fallback when API is unavailable
    console.log("Using local fallback reading generator");
    const reading = generateLocalReading(dominantHand, focusArea);
    return NextResponse.json(reading);
  }
}
