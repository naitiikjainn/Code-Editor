
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import redis from '../config/redis.js';
import Problem from '../models/Problem.js';
import { fetchCodeforcesProblem } from '../utils/codeforcesScraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const JSON_PATH = path.join(__dirname, "../../frontend/src/components/cp31.json");

// Connect DB
await mongoose.connect(process.env.MONGO_URI);
console.log("MongoDB Connected");

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const cp31 = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    let total = 0;
    let cached = 0;
    let fetched = 0;
    let failed = 0;

    const allProblems = [];
    Object.keys(cp31).forEach(rating => {
        cp31[rating].forEach(p => allProblems.push(p));
    });

    console.log(`Checking ${allProblems.length} CP-31 problems...`);

    for (const p of allProblems) {
        const problemId = `${p.contestId}${p.index}`;

        // 1. Check Redis
        const inRedis = await redis.exists(`problem:${problemId}`);
        if (inRedis) {
            cached++;
            // console.log(`[SKIP] ${problemId} in Redis`);
            continue;
        }

        // 2. Check Mongo
        const inMongo = await Problem.exists({ problemId });
        if (inMongo) {
            cached++;
            // Re-hydrate Redis if missing?
            const doc = await Problem.findOne({ problemId });
            await redis.setex(`problem:${problemId}`, 172800, JSON.stringify(doc.data));
            // console.log(`[HYDRATE] ${problemId} from Mongo -> Redis`);
            continue;
        }

        // 3. Needs Fetch
        console.log(`[FETCH] ${problemId} (Not cached)...`);
        try {
            const data = await fetchCodeforcesProblem(p.contestId, p.index);

            if (data) {
                // Save
                await Problem.findOneAndUpdate(
                    { problemId },
                    { problemId, data, lastAccessed: new Date() },
                    { upsert: true, new: true }
                );
                await redis.setex(`problem:${problemId}`, 172800, JSON.stringify(data));
                fetched++;
                console.log(`[SUCCESS] Cached ${problemId}`);
            }

            // Random delay 2-5s
            await delay(2000 + Math.random() * 3000);

        } catch (e) {
            console.error(`[FAIL] ${problemId}: ${e.message}`);
            failed++;
        }
    }

    console.log(`\nDone! Cached: ${cached}, Fetched (New): ${fetched}, Failed: ${failed}`);
    process.exit();
}

main().catch(console.error);
