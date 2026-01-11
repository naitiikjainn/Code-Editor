import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db.js";
import redis from "../config/redis.js";
import Problem from "../models/Problem.js";
import { fetchCodeforcesProblem } from "../utils/codeforcesScraper.js";

dotenv.config();

const PROBLEM_ID = "1890A";
const CONTEST_ID = 1890;
const INDEX = "A";

async function fix() {
    console.log(`🔧 Fixing Cache for ${PROBLEM_ID}...`);
    await connectDB();

    console.log("1. Clearing Redis & Mongo...");
    await redis.del(`problem:${PROBLEM_ID}`);
    await Problem.deleteOne({ problemId: PROBLEM_ID });

    console.log("2. Re-fetching from Codeforces...");
    const data = await fetchCodeforcesProblem(CONTEST_ID, INDEX);

    if (data) {
        console.log("✅ Fetched Data Title:", data.title);
        console.log("✅ Description Length:", data.description.length);

        console.log("3. Saving to DB...");
        await Problem.create({ problemId: PROBLEM_ID, data });
        await redis.set(`problem:${PROBLEM_ID}`, JSON.stringify(data));
        console.log("🎉 Fixed!");
    } else {
        console.error("❌ Fetch failed.");
    }
    process.exit();
}

fix();
