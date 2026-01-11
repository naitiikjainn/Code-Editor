import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
dotenv.config();
import redis from '../config/redis.js';
import connectDB from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Problem from '../models/Problem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cpData = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../frontend/src/components/cp31.json"), "utf-8"));

async function scrapeDescriptions() {
    console.log("🚀 Starting Puppeteer Scraper for Descriptions...");

    await connectDB();

    // Flatten problems
    const problems = [];
    for (const rating in cpData) {
        problems.push(...cpData[rating]);
    }

    console.log(`📋 Found ${problems.length} problems to check/scrape.`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set User Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let successCount = 0;

    for (const problem of problems) {
        const problemId = `${problem.contestId}${problem.index}`;

        // Check if DB already has description
        const dbProblem = await Problem.findOne({ problemId });
        if (dbProblem && dbProblem.data && dbProblem.data.description && !dbProblem.data.description.includes("No description available")) {
            console.log(`✅ ${problemId} already has description.`);
            continue;
        }

        const url = `https://codeforces.com/contest/${problem.contestId}/problem/${problem.index}`;
        console.log(`🌍 Visiting ${url}...`);

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for selector
            await page.waitForSelector('.problem-statement', { timeout: 5000 });

            // Extract content
            const data = await page.evaluate(() => {
                const titleEl = document.querySelector('.title');
                const statementEl = document.querySelector('.problem-statement');

                if (!statementEl) return null;

                // Clone to clean
                const clone = statementEl.cloneNode(true);
                // Remove header from clone if needed, but title is important.

                // Extract Inputs/Outputs with line preservation
                const inputs = [];
                const outputs = [];

                const extractText = (container) => {
                    const lines = [];
                    // CF uses .test-example-line for separate lines
                    const testLines = container.querySelectorAll('.test-example-line');
                    if (testLines.length > 0) {
                        testLines.forEach(l => lines.push(l.innerText));
                        return lines.join('\n');
                    }
                    // Fallback to innerText, but maybe try to replace <br> with \n first?
                    // Actually innerText usually handles <br> well, but let's be safe.
                    return container.innerText;
                };

                clone.querySelectorAll('.input pre').forEach(el => inputs.push(extractText(el)));
                clone.querySelectorAll('.output pre').forEach(el => outputs.push(extractText(el)));

                return {
                    description: clone.innerHTML, // Get full HTML
                    title: titleEl ? titleEl.innerText : "",
                    inputs,
                    outputs
                };
            });

            if (data) {
                // Update DB
                const upsertData = {
                    provider: "codeforces",
                    id: problemId,
                    title: data.title || problemId,
                    url: url,
                    description: data.description,
                    testCases: data.inputs.map((inp, i) => ({
                        input: inp,
                        expectedOutput: data.outputs[i] || ""
                    }))
                };

                await Problem.findOneAndUpdate(
                    { problemId },
                    {
                        problemId,
                        data: upsertData,
                        lastAccessed: new Date()
                    },
                    { upsert: true }
                );

                // Cache in Redis
                await redis.set(`problem:${problemId}`, JSON.stringify(upsertData), 'EX', 60 * 60 * 24 * 30); // 30 days

                console.log(`   ✨ Scraped & Cached ${problemId}`);
                successCount++;
            } else {
                console.warn(`   ⚠️ Could not find .problem-statement for ${problemId}`);
            }

            // Sleep slightly
            await new Promise(r => setTimeout(r, 2000));

        } catch (err) {
            console.error(`   ❌ Error scraping ${problemId}: ${err.message}`);
        }
    }

    await browser.close();
    console.log(`🎉 Finished. Scraped ${successCount} new descriptions.`);
    process.exit(0);
}

scrapeDescriptions();
