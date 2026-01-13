/**
 * Background Scraper Service
 * Continuously scrapes Codeforces problems starting from latest
 * Run this as a background process: node background_scraper.js
 * 
 * Features:
 * - Scrapes latest problems first (highest contest ID)
 * - Skips existing problems
 * - Auto-commits and pushes to GitHub periodically
 * - Handles rate limiting with delays
 * - Recovers from errors gracefully
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'codeforces-problems', 'content');
const REPO_DIR = path.join(__dirname, '..', '..', 'codeforces-problems');
const PROGRESS_FILE = path.join(REPO_DIR, 'scrape_progress.json');

// Configuration
const CONFIG = {
    // Delay between requests (ms) - important to avoid rate limiting
    requestDelay: 3000,
    // Max problems to scrape before taking a break
    batchSize: 50,
    // Break duration between batches (ms)
    batchBreak: 60000, // 1 minute
    // Auto-push to GitHub every N problems
    pushInterval: 100,
    // Starting contest ID (latest as of 2024)
    startContestId: 2100,
    // Minimum contest ID to scrape down to
    minContestId: 1,
    // Problem indices to try
    problemIndices: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2'],
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load or initialize progress
const loadProgress = () => {
    if (fs.existsSync(PROGRESS_FILE)) {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
    return {
        lastContestId: CONFIG.startContestId,
        scrapedCount: 0,
        failedProblems: [],
        lastRun: null
    };
};

const saveProgress = (progress) => {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
};

// Get existing problems
const getExistingProblems = () => {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    return new Set(
        fs.readdirSync(OUTPUT_DIR)
            .filter(f => f.endsWith('.html'))
            .map(f => f.replace('.html', ''))
    );
};

// Git operations
const gitCommitAndPush = (message) => {
    try {
        process.chdir(REPO_DIR);
        execSync('git add -A', { stdio: 'pipe' });
        execSync(`git commit -m "${message}"`, { stdio: 'pipe' });
        execSync('git push', { stdio: 'pipe' });
        console.log(`📤 Pushed to GitHub: ${message}`);
        return true;
    } catch (e) {
        // No changes to commit or push failed
        return false;
    }
};

// Scrape a single problem
const scrapeProblem = async (page, contestId, index) => {
    const problemId = `${contestId}_${index}`;
    const outputPath = path.join(OUTPUT_DIR, `${problemId}.html`);
    
    const urls = [
        `https://codeforces.com/contest/${contestId}/problem/${index}`,
        `https://codeforces.com/problemset/problem/${contestId}/${index}`
    ];
    
    for (const url of urls) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(2000);
            
            // Check if problem exists
            const hasContent = await page.evaluate(() => {
                return document.querySelector('.problem-statement') !== null;
            });
            
            if (!hasContent) {
                await sleep(3000);
                const stillNoContent = await page.evaluate(() => {
                    return document.querySelector('.problem-statement') === null;
                });
                if (stillNoContent) continue;
            }
            
            const html = await page.content();
            
            if (html.includes('problem-statement') && !html.includes('Just a moment')) {
                fs.writeFileSync(outputPath, html, 'utf-8');
                return 'success';
            }
        } catch (e) {
            // Try next URL
        }
    }
    
    return 'not_found';
};

// Main scraping loop
const main = async () => {
    console.log('🚀 Starting Background Scraper Service');
    console.log('   Press Ctrl+C to stop\n');
    
    let progress = loadProgress();
    let existing = getExistingProblems();
    let scraped = 0;
    let pushCounter = 0;
    
    console.log(`📊 Existing problems: ${existing.size}`);
    console.log(`📊 Starting from contest: ${progress.lastContestId}\n`);
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Stopping scraper...');
        saveProgress(progress);
        if (pushCounter > 0) {
            gitCommitAndPush(`Add ${pushCounter} problems (interrupted)`);
        }
        await browser.close();
        process.exit(0);
    });
    
    // Main loop - iterate through contests from latest to oldest
    for (let contestId = progress.lastContestId; contestId >= CONFIG.minContestId; contestId--) {
        for (const index of CONFIG.problemIndices) {
            const problemId = `${contestId}_${index}`;
            
            // Skip if already exists
            if (existing.has(problemId)) {
                continue;
            }
            
            console.log(`📥 Trying ${problemId}...`);
            const result = await scrapeProblem(page, contestId, index);
            
            if (result === 'success') {
                console.log(`   ✅ Saved!`);
                existing.add(problemId);
                scraped++;
                pushCounter++;
                progress.scrapedCount++;
            }
            
            // Update progress
            progress.lastContestId = contestId;
            progress.lastRun = new Date().toISOString();
            
            // Auto-push to GitHub
            if (pushCounter >= CONFIG.pushInterval) {
                saveProgress(progress);
                gitCommitAndPush(`Add ${pushCounter} new problems (contest ${contestId})`);
                pushCounter = 0;
            }
            
            // Batch break
            if (scraped > 0 && scraped % CONFIG.batchSize === 0) {
                console.log(`\n⏸️  Taking a ${CONFIG.batchBreak / 1000}s break after ${scraped} problems...\n`);
                saveProgress(progress);
                await sleep(CONFIG.batchBreak);
            }
            
            // Delay between requests
            await sleep(CONFIG.requestDelay);
        }
    }
    
    // Final push
    if (pushCounter > 0) {
        saveProgress(progress);
        gitCommitAndPush(`Add ${pushCounter} problems (complete)`);
    }
    
    console.log(`\n✅ Scraping complete! Total scraped: ${progress.scrapedCount}`);
    await browser.close();
};

main().catch(console.error);
