import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import Problem from "../models/Problem.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CP31_PATH = path.resolve(__dirname, "../../frontend/src/components/cp31.json");

async function syncNames() {
    console.log("🔄 Syncing Problem Names from Codeforces API...");

    if (!fs.existsSync(CP31_PATH)) {
        console.error("❌ cp31.json not found");
        process.exit(1);
    }

    // 1. Fetch Global Problem List
    console.log("🌍 Fetching global problemset from Codeforces API...");
    const res = await fetch("https://codeforces.com/api/problemset.problems");
    const data = await res.json();

    if (data.status !== "OK") {
        console.error("❌ Failed to fetch CF API");
        process.exit(1);
    }

    const globalProblems = data.result.problems; // [{ contestId, index, name, ... }]
    console.log(`✅ Loaded ${globalProblems.length} problems.`);

    const cpData = JSON.parse(fs.readFileSync(CP31_PATH, "utf-8"));
    let totalUpdated = 0;

    for (const rating in cpData) {
        const problems = cpData[rating];
        for (const p of problems) {
            // Find match
            const match = globalProblems.find(gp => gp.contestId === p.contestId && gp.index === p.index);
            if (match) {
                let changed = false;
                if (p.name !== match.name) {
                    p.name = match.name;
                    changed = true;
                }
                // Sync Tags
                if (match.tags && JSON.stringify(p.tags) !== JSON.stringify(match.tags)) {
                    p.tags = match.tags;
                    changed = true;
                }

                if (changed) totalUpdated++;
            } else {
                console.warn(`⚠️ Not found in API: ${p.contestId}${p.index}`);
            }
        }
    }

    fs.writeFileSync(CP31_PATH, JSON.stringify(cpData, null, 4));
    console.log(`✅ Updated names for ${totalUpdated} problems.`);
    console.log("🎉 Sync Complete.");
    process.exit(0);
}

syncNames();
