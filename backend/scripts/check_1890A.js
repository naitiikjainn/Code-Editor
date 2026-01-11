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
        console.log("--- DESCRIPTION START ---");
        // Log a substring to check the specific part
        const snippet = problem.data.description.match(/\$\$\$(.*?)\$\$\$/g);
        console.log("Math Snippets Found:", snippet);
        console.log("--- DESCRIPTION END ---");
    } else {
        console.log("❌ Problem not found.");
    }
    process.exit();
}

check();
