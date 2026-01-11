import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import redis from "../config/redis.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CP31_PATH = path.resolve(__dirname, "../../frontend/src/components/cp31.json");

async function recover() {
    console.log("🚑 Starting CP-31 Recovery...");

    // 1. Get ALL keys from Redis
    // We assume keys are "problem:<id>" or "cf:<id>:<index>"?
    // seedCP31.js used: `await redis.set(problem:${problemId}, ...)`
    // So keys are "problem:*"

    // We need to wait for redis connection?
    // scan or keys? keys is fine for ~200 items.

    // Simple wait for redis ready
    let attempts = 0;
    while (redis.status !== 'ready' && attempts < 10) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
    }

    const keys = await redis.keys("problem:*");
    console.log(`🔑 Found ${keys.length} cached problems in Redis.`);

    if (keys.length === 0) {
        console.error("❌ No problems found in Redis to recover.");
        process.exit(1);
    }

    // 2. Fetch Codeforces Global Problem List for Ratings
    console.log("🌍 Fetching Codeforces Problemset for ratings...");
    const cfRes = await fetch("https://codeforces.com/api/problemset.problems");
    const cfData = await cfRes.json();

    if (cfData.status !== "OK") {
        console.error("❌ Failed to fetch Codeforces API");
        process.exit(1);
    }

    const problemsGlobal = cfData.result.problems; // Array of { contestId, index, name, rating, tags }
    console.log(`   -> Loaded ${problemsGlobal.length} problems from CF.`);

    // 3. Map Redis IDs to Ratings
    const recoveredData = {}; // { "800": [], "900": [] ... }

    // Keep track of counts
    const counts = {};

    for (const key of keys) {
        const problemId = key.replace("problem:", "");
        // problemId is like "1899A" or "1234B2"
        // We need to parse contestId and index.
        // Regex: ^(\d+)(.*)$
        const match = problemId.match(/^(\d+)(.*)$/);
        if (!match) continue;

        const contestId = parseInt(match[1]);
        const index = match[2];

        // Find in global list
        const meta = problemsGlobal.find(p => p.contestId === contestId && p.index === index);

        if (meta && meta.rating) {
            const rating = String(meta.rating);
            if (!recoveredData[rating]) recoveredData[rating] = [];

            // Reconstruct the entry for cp31.json
            // existing entries had: { contestId, index, name, (url?), id }
            // Scraper usually adds 'url'.
            recoveredData[rating].push({
                contestId: meta.contestId,
                index: meta.index,
                name: meta.name,
                rating: rating,
                id: problemId,
                url: `https://codeforces.com/contest/${meta.contestId}/problem/${meta.index}`
            });

            counts[rating] = (counts[rating] || 0) + 1;
        } else {
            console.warn(`⚠️  Could not find rating for ${problemId} (or unrated)`);
            // Maybe put in "Unrated"? Or skip.
            // Best to skip for strict CP-31 structure.
        }
    }

    // 4. Sort and Save
    // Sort keys grouping
    const sortedRatings = Object.keys(recoveredData).sort((a, b) => Number(a) - Number(b));
    const finalJSON = {};

    for (const r of sortedRatings) {
        // Sort problems inside by ID or Index?
        // scraper sorted by name usually? Or just list.
        finalJSON[r] = recoveredData[r].sort((a, b) => (a.contestId - b.contestId) || a.index.localeCompare(b.index));
    }

    console.log("✅ Recovery Summary:");
    let totalRecovered = 0;
    for (const r in counts) {
        console.log(`   Rating ${r}: ${counts[r]} problems`);
        totalRecovered += counts[r];
    }
    console.log(`   Total Recovered: ${totalRecovered}`);

    fs.writeFileSync(CP31_PATH, JSON.stringify(finalJSON, null, 4));
    console.log(`💾 Saved to ${CP31_PATH}`);

    process.exit(0);
}

recover();
