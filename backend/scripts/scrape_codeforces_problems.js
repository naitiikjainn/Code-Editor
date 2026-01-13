/**
 * Codeforces Problem Scraper
 * 
 * This script scrapes Codeforces problems and saves them as static HTML files
 * that can be hosted on GitHub Pages or served via raw GitHub content.
 * 
 * Usage:
 *   node scrape_codeforces_problems.js                    # Scrape recent problems
 *   node scrape_codeforces_problems.js --contest 1990    # Scrape specific contest
 *   node scrape_codeforces_problems.js --range 1900-2000 # Scrape contest range
 *   node scrape_codeforces_problems.js --all             # Scrape all problems (slow!)
 * 
 * Output: ./codeforces-problems/content/{contestId}:{index}.html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    outputDir: path.join(__dirname, '..', '..', 'codeforces-problems', 'content'),
    requestDelay: 2000,      // 2 seconds between requests (be nice to CF servers)
    maxRetries: 3,
    userAgents: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
    ]
};

// Stats
const stats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
};

// Helper: Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Random User Agent
const getRandomUA = () => CONFIG.userAgents[Math.floor(Math.random() * CONFIG.userAgents.length)];

// Helper: Fetch with retry
const fetchWithRetry = async (url, retries = CONFIG.maxRetries) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': getRandomUA(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.status === 403) {
                console.log(`  ⚠️  403 Forbidden (Cloudflare) - attempt ${attempt}/${retries}`);
                if (attempt < retries) {
                    await sleep(5000 * attempt); // Exponential backoff
                    continue;
                }
                return null;
            }

            if (response.status === 404) {
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.text();
        } catch (error) {
            console.log(`  ❌ Attempt ${attempt}/${retries} failed: ${error.message}`);
            if (attempt < retries) {
                await sleep(2000 * attempt);
            }
        }
    }
    return null;
};

// Get all problems from CF API
const fetchProblemList = async () => {
    console.log('📋 Fetching problem list from Codeforces API...');
    
    try {
        const response = await fetch('https://codeforces.com/api/problemset.problems');
        const data = await response.json();
        
        if (data.status !== 'OK') {
            throw new Error('API returned error status');
        }
        
        console.log(`   Found ${data.result.problems.length} problems\n`);
        return data.result.problems;
    } catch (error) {
        console.error('Failed to fetch problem list:', error.message);
        return [];
    }
};

// Scrape a single problem
const scrapeProblem = async (contestId, index) => {
    const problemId = `${contestId}_${index}`;
    const outputPath = path.join(CONFIG.outputDir, `${problemId}.html`);
    
    // Skip if already exists
    if (fs.existsSync(outputPath)) {
        stats.skipped++;
        return { success: true, skipped: true };
    }
    
    const url = `https://codeforces.com/contest/${contestId}/problem/${index}`;
    console.log(`📥 Scraping ${problemId}...`);
    
    const html = await fetchWithRetry(url);
    
    if (!html) {
        stats.failed++;
        stats.errors.push(problemId);
        console.log(`   ❌ Failed to fetch ${problemId}`);
        return { success: false };
    }
    
    // Check if it's a valid problem page
    if (!html.includes('problem-statement')) {
        // Try alternate URL format
        const altUrl = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
        console.log(`   Trying alternate URL...`);
        
        const altHtml = await fetchWithRetry(altUrl);
        
        if (altHtml && altHtml.includes('problem-statement')) {
            fs.writeFileSync(outputPath, altHtml, 'utf-8');
            stats.success++;
            console.log(`   ✅ Saved ${problemId} (alt URL)`);
            return { success: true };
        }
        
        stats.failed++;
        stats.errors.push(problemId);
        console.log(`   ❌ No problem-statement found for ${problemId}`);
        return { success: false };
    }
    
    // Save the HTML
    fs.writeFileSync(outputPath, html, 'utf-8');
    stats.success++;
    console.log(`   ✅ Saved ${problemId}`);
    
    return { success: true };
};

// Scrape problems by contest range
const scrapeByRange = async (startContest, endContest) => {
    console.log(`\n🎯 Scraping contests ${startContest} to ${endContest}...\n`);
    
    const problems = await fetchProblemList();
    
    // Filter by contest range
    const filtered = problems.filter(p => 
        p.contestId >= startContest && p.contestId <= endContest
    );
    
    console.log(`   ${filtered.length} problems in range\n`);
    stats.total = filtered.length;
    
    for (const problem of filtered) {
        await scrapeProblem(problem.contestId, problem.index);
        await sleep(CONFIG.requestDelay);
    }
};

// Scrape specific contest
const scrapeContest = async (contestId) => {
    console.log(`\n🎯 Scraping contest ${contestId}...\n`);
    
    const problems = await fetchProblemList();
    const filtered = problems.filter(p => p.contestId == contestId);
    
    console.log(`   ${filtered.length} problems in contest\n`);
    stats.total = filtered.length;
    
    for (const problem of filtered) {
        await scrapeProblem(problem.contestId, problem.index);
        await sleep(CONFIG.requestDelay);
    }
};

// Scrape recent problems (last N contests)
const scrapeRecent = async (numContests = 50) => {
    console.log(`\n🎯 Scraping last ${numContests} contests...\n`);
    
    const problems = await fetchProblemList();
    
    // Get unique contest IDs and sort descending
    const contestIds = [...new Set(problems.map(p => p.contestId))].sort((a, b) => b - a);
    const recentContests = contestIds.slice(0, numContests);
    
    const filtered = problems.filter(p => recentContests.includes(p.contestId));
    
    console.log(`   ${filtered.length} problems in ${numContests} recent contests\n`);
    stats.total = filtered.length;
    
    // Sort by contest ID descending (newest first)
    filtered.sort((a, b) => b.contestId - a.contestId || a.index.localeCompare(b.index));
    
    for (const problem of filtered) {
        await scrapeProblem(problem.contestId, problem.index);
        await sleep(CONFIG.requestDelay);
    }
};

// Scrape all problems
const scrapeAll = async () => {
    console.log(`\n🎯 Scraping ALL problems (this will take a while)...\n`);
    
    const problems = await fetchProblemList();
    stats.total = problems.length;
    
    // Sort by contest ID descending
    problems.sort((a, b) => b.contestId - a.contestId || a.index.localeCompare(b.index));
    
    for (const problem of problems) {
        await scrapeProblem(problem.contestId, problem.index);
        await sleep(CONFIG.requestDelay);
    }
};

// Print final stats
const printStats = () => {
    console.log('\n' + '='.repeat(50));
    console.log('📊 SCRAPING COMPLETE');
    console.log('='.repeat(50));
    console.log(`   Total:   ${stats.total}`);
    console.log(`   Success: ${stats.success}`);
    console.log(`   Skipped: ${stats.skipped} (already exists)`);
    console.log(`   Failed:  ${stats.failed}`);
    
    if (stats.errors.length > 0) {
        console.log(`\n❌ Failed problems:`);
        stats.errors.forEach(id => console.log(`   - ${id}`));
    }
    
    console.log('\n📁 Output directory:', CONFIG.outputDir);
    console.log('='.repeat(50));
};

// Main
const main = async () => {
    console.log('🚀 Codeforces Problem Scraper');
    console.log('='.repeat(50));
    
    // Ensure output directory exists
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    
    // Parse arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--all')) {
        await scrapeAll();
    } else if (args.includes('--contest')) {
        const contestIdx = args.indexOf('--contest');
        const contestId = parseInt(args[contestIdx + 1]);
        if (isNaN(contestId)) {
            console.error('❌ Invalid contest ID');
            process.exit(1);
        }
        await scrapeContest(contestId);
    } else if (args.includes('--range')) {
        const rangeIdx = args.indexOf('--range');
        const range = args[rangeIdx + 1];
        const [start, end] = range.split('-').map(Number);
        if (isNaN(start) || isNaN(end)) {
            console.error('❌ Invalid range format. Use: --range 1900-2000');
            process.exit(1);
        }
        await scrapeByRange(start, end);
    } else if (args.includes('--recent')) {
        const recentIdx = args.indexOf('--recent');
        const num = parseInt(args[recentIdx + 1]) || 50;
        await scrapeRecent(num);
    } else {
        // Default: scrape recent 50 contests
        await scrapeRecent(50);
    }
    
    printStats();
};

main().catch(console.error);
