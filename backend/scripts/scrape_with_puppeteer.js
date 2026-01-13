/**
 * Puppeteer-based Codeforces Problem Scraper
 * 
 * Uses a real browser to bypass Cloudflare protection.
 * 
 * Prerequisites:
 *   npm install puppeteer
 * 
 * Usage:
 *   node scrape_with_puppeteer.js 2052 M           # Single problem
 *   node scrape_with_puppeteer.js --contest 2052  # Entire contest
 *   node scrape_with_puppeteer.js --recent 10     # Last 10 contests
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'codeforces-problems', 'content');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Stats
const stats = { total: 0, success: 0, failed: 0, skipped: 0 };

// Get problem list from API
const fetchProblemList = async () => {
    console.log('📋 Fetching problem list from Codeforces API...');
    try {
        const response = await fetch('https://codeforces.com/api/problemset.problems');
        const data = await response.json();
        if (data.status === 'OK') {
            console.log(`   Found ${data.result.problems.length} problems\n`);
            return data.result.problems;
        }
    } catch (e) {
        console.error('Failed to fetch problem list:', e.message);
    }
    return [];
};

// Scrape a single problem with Puppeteer
const scrapeProblem = async (page, contestId, index) => {
    const problemId = `${contestId}_${index}`;
    const outputPath = path.join(OUTPUT_DIR, `${problemId}.html`);
    
    // Skip if exists
    if (fs.existsSync(outputPath)) {
        stats.skipped++;
        return true;
    }
    
    const url = `https://codeforces.com/contest/${contestId}/problem/${index}`;
    console.log(`📥 Scraping ${problemId}...`);
    
    try {
        // Navigate with longer timeout for Cloudflare
        await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 60000 
        });
        
        // Wait for potential Cloudflare challenge to resolve
        await sleep(3000);
        
        // Check if we're on a Cloudflare page
        const pageContent = await page.content();
        if (pageContent.includes('Just a moment') || pageContent.includes('Checking your browser')) {
            console.log(`   ⏳ Waiting for Cloudflare challenge...`);
            await sleep(10000); // Wait longer for Cloudflare
            
            // Refresh and try again
            await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
            await sleep(3000);
        }
        
        // Wait for problem content
        try {
            await page.waitForSelector('.problem-statement', { timeout: 15000 });
        } catch {
            // Try alternate URL
            const altUrl = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
            console.log(`   Trying alternate URL...`);
            await page.goto(altUrl, { waitUntil: 'networkidle0', timeout: 60000 });
            await sleep(3000);
            await page.waitForSelector('.problem-statement', { timeout: 15000 });
        }
        
        // Get full HTML
        const html = await page.content();
        
        if (!html.includes('problem-statement')) {
            throw new Error('No problem-statement found');
        }
        
        // Save
        fs.writeFileSync(outputPath, html, 'utf-8');
        stats.success++;
        console.log(`   ✅ Saved ${problemId}`);
        
        return true;
    } catch (error) {
        stats.failed++;
        console.log(`   ❌ Failed: ${error.message}`);
        return false;
    }
};

// Main
const main = async () => {
    console.log('🚀 Puppeteer Codeforces Scraper');
    console.log('='.repeat(50));
    
    const args = process.argv.slice(2);
    
    // Launch browser
    console.log('\n🌐 Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,  // Use visible browser to handle Cloudflare better
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled', // Hide automation
            '--window-size=1920x1080'
        ],
        defaultViewport: null // Use window size
    });
    
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Block unnecessary resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            req.abort();
        } else {
            req.continue();
        }
    });
    
    try {
        if (args.length >= 2 && !args[0].startsWith('--')) {
            // Single problem: node script.js 2052 M
            const contestId = args[0];
            const index = args[1].toUpperCase();
            stats.total = 1;
            
            await scrapeProblem(page, contestId, index);
            
        } else if (args.includes('--contest')) {
            // Entire contest
            const contestIdx = args.indexOf('--contest');
            const contestId = parseInt(args[contestIdx + 1]);
            
            const problems = await fetchProblemList();
            const filtered = problems.filter(p => p.contestId == contestId);
            
            stats.total = filtered.length;
            console.log(`\n🎯 Scraping contest ${contestId} (${filtered.length} problems)...\n`);
            
            for (const problem of filtered) {
                await scrapeProblem(page, problem.contestId, problem.index);
                await sleep(2000); // Rate limit
            }
            
        } else if (args.includes('--recent')) {
            // Recent contests
            const recentIdx = args.indexOf('--recent');
            const num = parseInt(args[recentIdx + 1]) || 10;
            
            const problems = await fetchProblemList();
            const contestIds = [...new Set(problems.map(p => p.contestId))].sort((a, b) => b - a);
            const recentContests = contestIds.slice(0, num);
            const filtered = problems.filter(p => recentContests.includes(p.contestId));
            
            stats.total = filtered.length;
            console.log(`\n🎯 Scraping ${num} recent contests (${filtered.length} problems)...\n`);
            
            filtered.sort((a, b) => b.contestId - a.contestId);
            
            for (const problem of filtered) {
                await scrapeProblem(page, problem.contestId, problem.index);
                await sleep(2000);
            }
            
        } else {
            console.log('\nUsage:');
            console.log('  node scrape_with_puppeteer.js 2052 M           # Single problem');
            console.log('  node scrape_with_puppeteer.js --contest 2052  # Entire contest');
            console.log('  node scrape_with_puppeteer.js --recent 10     # Last 10 contests');
        }
        
    } finally {
        await browser.close();
    }
    
    // Print stats
    console.log('\n' + '='.repeat(50));
    console.log('📊 Results:');
    console.log(`   Total:   ${stats.total}`);
    console.log(`   Success: ${stats.success}`);
    console.log(`   Skipped: ${stats.skipped}`);
    console.log(`   Failed:  ${stats.failed}`);
    console.log('='.repeat(50));
};

main().catch(console.error);
