
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

async function list() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.models) {
            const names = data.models.map(m => m.name).join("\n");
            fs.writeFileSync("available_models.txt", names);
            console.log("Written to available_models.txt");
        } else {
            fs.writeFileSync("available_models.txt", "ERROR: " + JSON.stringify(data));
            console.log("Error written to available_models.txt");
        }
    } catch (e) {
        fs.writeFileSync("available_models.txt", "EXCEPTION: " + e.message);
    }
}
list();
