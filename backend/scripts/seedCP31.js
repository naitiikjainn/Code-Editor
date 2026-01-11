import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../db.js";
import redis from "../config/redis.js";
import Problem from "../models/Problem.js";
import { fetchCodeforcesProblem } from "../utils/codeforcesScraper.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to cp31.json
// backend/scripts/seedCP31.js -> ../../frontend/src/components/cp31.json
const CP31_PATH = path.resolve(__dirname, "../../frontend/src/components/cp31.json");

async function seed() {
    console.log("🚀 Starting CP-31 Seeding...");

    // Connect to MongoDB
    await connectDB();

    // Check Redis Connection
    if (redis.status === 'ready' || redis.status === 'connecting') {
        console.log("✅ Redis connected");
    } else {
        console.error("❌ Redis not ready/connected");
        // process.exit(1); 
        // Redis client usually auto-connects, but let's see.
    }

    // Load Data
    if (!fs.existsSync(CP31_PATH)) {
        console.error(`❌ CP31 Data not found at ${CP31_PATH}`);
        process.exit(1);
    }
    const cpData = JSON.parse(fs.readFileSync(CP31_PATH, "utf-8"));

    let totalProblems = 0;
    const problems = [];

    // Flatten list
    for (const rating in cpData) {
        cpData[rating].forEach(p => {
            problems.push({ ...p, rating });
            totalProblems++;
        });
    }

    console.log(`📋 Found ${totalProblems} problems to cache.`);

    // Concurrency Limit
    const CONCURRENCY = 1;
    let processed = 0;

    for (let i = 0; i < problems.length; i += CONCURRENCY) {
        const batch = problems.slice(i, i + CONCURRENCY);

        await Promise.all(batch.map(async (p) => {
            const { contestId, index } = p;
            const problemId = `${contestId}${index}`;

            try {
                // 1. Fetch (Scrape or skipped if logic inside, but our scraper always fetches)
                // We want to force refresh? Or just ensure it exists?
                // User said "store them permanently". 
                // We'll fetch fresh copy to be sure.
                // Optimized: Check Mongo first
                const cached = await Problem.findOne({ problemId });

                if (cached && cached.data && cached.data.description && cached.data.description !== "<p>No description available.</p>") {
                    console.log(`   -> Found in DB. Ensuring Redis persistence...`);
                    // Ensure Redis is permanent
                    await redis.set(`problem:${problemId}`, JSON.stringify(cached.data));
                } else {
                    console.log(`\n[${processed + 1}/${totalProblems}] Scraping ${problemId}...`);
                    const data = await fetchCodeforcesProblem(contestId, index);

                    // Save to DB
                    await Problem.findOneAndUpdate(
                        { problemId },
                        { problemId, data },
                        { upsert: true, new: true }
                    );
                    // Save to Redis PERMANENTLY (no EX)
                    await redis.set(`problem:${problemId}`, JSON.stringify(data));
                    console.log(`   ✅ Cached ${problemId} permanently.`);
                }
            } catch (err) {
                console.error(`   ❌ Failed ${problemId}: ${err.message}`);
            } finally {
                processed++;
            }
        }));

        // Delay to be nice
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log("🎉 Seeding Complete!");
    process.exit(0);
}

seed();
