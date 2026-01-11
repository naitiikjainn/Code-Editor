import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../db.js";
import redis from "../config/redis.js";
import Problem from "../models/Problem.js";

dotenv.config();

const PROBLEM_ID = "1890A";
const DATA = {
    provider: "codeforces",
    id: "1890A",
    title: "Doremy's Paint 3",
    url: "https://codeforces.com/contest/1890/problem/A",
    description: `
    <div class="problem-statement">
        <div class="header">
            <div class="title">A. Doremy's Paint 3</div>
            <div class="time-limit">time limit per test: 1 second</div>
            <div class="memory-limit">memory limit per test: 256 megabytes</div>
            <div class="input-file">input: standard input</div>
            <div class="output-file">output: standard output</div>
        </div>
        <div>
            <p>Doremy has an array $$$a$$$ of $$$n$$$ integers. She wants to check if it is possible to reorder the elements of the array such that for every $$$i$$$ ($$$1 \\le i < n$$$), $$$a_i + a_{i+1} = a_{i+1} + a_{i+2}$$$.</p>
            <p>Wait, isn't that condition always true? Yes, $$$a_i + a_{i+1} = a_{i+1} + a_{i+2}$$$ simplifies to $$$a_i = a_{i+2}$$$.</p>
            <p>So, the condition is equivalent to: every element is equal to the element located 2 positions after it. In other words, the array must look like $$$x, y, x, y, x, y, \\dots$$$.</p>
            <p>Your task is to determine if the array can be reordered to satisfy this condition.</p>
        </div>
        <div class="input-specification">
            <div class="section-title">Input</div>
            <p>The first line contains a single integer $$$t$$$ ($$$1 \\le t \\le 100$$$) — the number of test cases.</p>
            <p>The first line of each test case contains a single integer $$$n$$$ ($$$2 \\le n \\le 100$$$).</p>
            <p>The second line contains $$$n$$$ integers $$$a_1, a_2, \\dots, a_n$$$ ($$$1 \\le a_i \\le 10^5$$$).</p>
        </div>
        <div class="output-specification">
            <div class="section-title">Output</div>
            <p>For each test case, output "YES" (without quotes) if it is possible, and "NO" otherwise. You can output the answer in any case (upper or lower).</p>
        </div>
    </div>
    `,
    testCases: [
        {
            input: "5\n2\n8 9\n3\n1 1 2\n4\n1 1 4 5\n5\n2 3 3 3 3\n4\n100000 100000 100000 100000",
            expectedOutput: "YES\nYES\nNO\nNO\nYES"
        }
    ]
};

async function forceSeed() {
    console.log(`🚀 Force Seeding ${PROBLEM_ID}...`);
    await connectDB();

    // 1. Delete Old
    await Problem.deleteOne({ problemId: PROBLEM_ID });
    await redis.del(`problem:${PROBLEM_ID}`);

    // 2. Insert New
    await Problem.create({ problemId: PROBLEM_ID, data: DATA });
    await redis.set(`problem:${PROBLEM_ID}`, JSON.stringify(DATA));

    console.log("✅ Successfully injected 1890A into DB and Redis.");
    process.exit(0);
}

forceSeed();
