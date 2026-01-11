
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateProjectConcept(industry: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Propose a high-end digital agency project concept for the ${industry} industry. Focus on minimalist aesthetics, smooth motion, and futuristic identity.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          conceptName: { type: Type.STRING },
          visualDirection: { type: Type.STRING },
          keyFeature: { type: Type.STRING }
        },
        required: ["conceptName", "visualDirection", "keyFeature"]
      }
    }
  });

  return JSON.parse(response.text);
}
