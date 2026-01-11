import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db.js";
import Problem from "../models/Problem.js";

dotenv.config();

const PROBLEM_ID = "1890A";

async function check() {
    console.log(`🔍 Checking ${PROBLEM_ID}...`);
    await connectDB();

    const problem = await Problem.findOne({ problemId: PROBLEM_ID });
    if (problem) {
        console.log("--- DATA START ---");
        console.log("contestId:", problem.data.contestId);
        console.log("index:", problem.data.index);
        console.log("title:", problem.data.title);
        console.log("--- DATA END ---");
    } else {
        console.log("❌ Problem not found.");
    }
    process.exit();
}

check();
