/**
 * Scheduled Scraper
 * Runs on a schedule to scrape latest problems
 * Can be set up as a Windows Task Scheduler or cron job
 * 
 * Usage: 
 *   node scheduled_scrape.js           - Scrape latest 50 contests
 *   node scheduled_scrape.js 100       - Scrape latest 100 contests
 *   node scheduled_scrape.js 50 true   - Scrape and push to GitHub
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

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Problem indices to try for each contest
const PROBLEM_INDICES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];

// Get existing problems
const getExistingProblems = () => {
    return new Set(
        fs.readdirSync(OUTPUT_DIR)
            .filter(f => f.endsWith('.html'))
            .map(f => f.replace('.html', ''))
    );
};

// Get latest contest ID from Codeforces
const getLatestContestId = async (page) => {
    try {
        await page.goto('https://codeforces.com/contests', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(2000);
        
        const latestId = await page.evaluate(() => {
            const links = document.querySelectorAll('a[href*="/contest/"]');
            let maxId = 0;
            for (const link of links) {
                const match = link.href.match(/\/contest\/(\d+)/);
                if (match) {
                    const id = parseInt(match[1]);
                    if (id > maxId) maxId = id;
                }
            }
            return maxId;
        });
        
        return latestId || 2100;
    } catch (e) {
        console.log('Error getting latest contest, using default:', e.message);
        return 2100;
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

// Git operations
const gitCommitAndPush = (message) => {
    try {
        process.chdir(REPO_DIR);
        execSync('git add -A', { stdio: 'pipe' });
        
        // Check if there are changes
        const status = execSync('git status --porcelain', { encoding: 'utf-8' });
        if (!status.trim()) {
            console.log('📝 No new changes to commit');
            return false;
        }
        
        execSync(`git commit -m "${message}"`, { stdio: 'pipe' });
        execSync('git push', { stdio: 'pipe' });
        console.log(`📤 Pushed: ${message}`);
        return true;
    } catch (e) {
        console.log('⚠️ Git operation failed:', e.message);
        return false;
    }
};

// Main
const main = async () => {
    const args = process.argv.slice(2);
    const contestCount = parseInt(args[0]) || 50;
    const shouldPush = args[1] === 'true';
    
    console.log(`\n🚀 Scheduled Scraper - ${new Date().toISOString()}`);
    console.log(`   Contests to check: ${contestCount}`);
    console.log(`   Auto-push: ${shouldPush}\n`);
    
    const existing = getExistingProblems();
    console.log(`📊 Existing problems: ${existing.size}\n`);
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Get latest contest ID
    const latestContestId = await getLatestContestId(page);
    console.log(`📌 Latest contest: ${latestContestId}\n`);
    
    let newProblems = 0;
    let checkedContests = 0;
    
    // Scrape from latest to oldest
    for (let contestId = latestContestId; contestId > latestContestId - contestCount && contestId > 0; contestId--) {
        checkedContests++;
        let foundAny = false;
        
        for (const index of PROBLEM_INDICES) {
            const problemId = `${contestId}_${index}`;
            
            if (existing.has(problemId)) {
                continue;
            }
            
            const result = await scrapeProblem(page, contestId, index);
            
            if (result === 'success') {
                console.log(`✅ ${problemId}`);
                existing.add(problemId);
                newProblems++;
                foundAny = true;
            }
            
            await sleep(2000);
        }
        
        // Progress update every 10 contests
        if (checkedContests % 10 === 0) {
            console.log(`\n📊 Progress: ${checkedContests}/${contestCount} contests, ${newProblems} new problems\n`);
        }
    }
    
    await browser.close();
    
    // Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 SUMMARY`);
    console.log(`   Contests checked: ${checkedContests}`);
    console.log(`   New problems: ${newProblems}`);
    console.log(`   Total problems: ${existing.size}`);
    console.log(`${'='.repeat(50)}\n`);
    
    // Push to GitHub if requested
    if (shouldPush && newProblems > 0) {
        gitCommitAndPush(`Add ${newProblems} new problems (scheduled scrape)`);
    }
    
    console.log('✅ Done!\n');
};

main().catch(console.error);
