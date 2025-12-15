import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

// Simple script to check what models are available to your Key
async function checkModels() {
  if (!process.env.GEMINI_API_KEY) {
    console.log("❌ No API Key found in .env");
    return;
  }

  console.log("Checking available models...");
  // We use a raw fetch here to bypass any SDK version weirdness
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        console.error("❌ API Error:", data.error.message);
    } else {
        console.log("✅ Connection Successful! Available models:");
        // Filter for just the names to make it readable
        const models = data.models.map(m => m.name.replace("models/", ""));
        console.log(models.join(", "));
        
        if (models.includes("gemini-1.5-flash")) {
            console.log("\nSUCCESS: gemini-1.5-flash is available for your key.");
        } else {
            console.log("\n⚠️ ISSUE: gemini-1.5-flash is NOT in your list.");
        }
    }
  } catch (error) {
    console.error("❌ Network Error:", error);
  }
}

checkModels();