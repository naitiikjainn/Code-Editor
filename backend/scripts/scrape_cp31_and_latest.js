/**
 * CP31 + Latest Problems Scraper
 * 
 * Scrapes all CP31 sheet problems first, then latest Codeforces problems.
 * Uses Puppeteer to bypass Cloudflare.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'codeforces-problems', 'content');
const CP31_PATH = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'cp31.json');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const stats = { total: 0, success: 0, failed: 0, skipped: 0, failedProblems: [] };

// Load CP31 problems
const loadCP31Problems = () => {
    const data = JSON.parse(fs.readFileSync(CP31_PATH, 'utf-8'));
    const problems = [];
    Object.values(data).forEach(arr => {
        arr.forEach(p => problems.push({ contestId: p.contestId, index: p.index }));
    });
    return problems;
};

// Fetch problem list from API
const fetchAllProblems = async () => {
    console.log('📋 Fetching problem list from Codeforces API...');
    try {
        const response = await fetch('https://codeforces.com/api/problemset.problems');
        const data = await response.json();
        if (data.status === 'OK') {
            return data.result.problems;
        }
    } catch (e) {
        console.error('Failed:', e.message);
    }
    return [];
};

// Scrape single problem
const scrapeProblem = async (page, contestId, index, retries = 3) => {
    const problemId = `${contestId}_${index}`;
    const outputPath = path.join(OUTPUT_DIR, `${problemId}.html`);
    
    if (fs.existsSync(outputPath)) {
        stats.skipped++;
        return true;
    }
    
    const url = `https://codeforces.com/contest/${contestId}/problem/${index}`;
    process.stdout.write(`📥 ${problemId}... `);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            
            // Wait for problem content or Cloudflare to pass
            try {
                await page.waitForSelector('.problem-statement', { timeout: 20000 });
            } catch {
                // Try alternate URL
                const altUrl = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
                await page.goto(altUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
                await page.waitForSelector('.problem-statement', { timeout: 20000 });
            }
            
            const html = await page.content();
            
            if (html.includes('problem-statement')) {
                fs.writeFileSync(outputPath, html, 'utf-8');
                stats.success++;
                console.log('✅');
                return true;
            }
        } catch (error) {
            if (attempt < retries) {
                process.stdout.write(`retry... `);
                await sleep(5000);
            }
        }
    }
    
    stats.failed++;
    stats.failedProblems.push(problemId);
    console.log('❌');
    return false;
};

// Save progress periodically
const saveProgress = () => {
    const progressPath = path.join(OUTPUT_DIR, '..', 'scrape_progress.json');
    fs.writeFileSync(progressPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        stats,
        files: fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.html')).length
    }, null, 2));
};

const main = async () => {
    console.log('🚀 CP31 + Latest Problems Scraper');
    console.log('=' .repeat(50));
    
    // Launch browser (visible to handle Cloudflare)
    console.log('\n🌐 Launching browser (keep it open!)...\n');
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280x800'
        ],
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Block images/css for speed
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });
    
    try {
        // --- PHASE 1: CP31 Problems ---
        console.log('📚 PHASE 1: Scraping CP31 Sheet Problems...\n');
        const cp31Problems = loadCP31Problems();
        console.log(`   Found ${cp31Problems.length} CP31 problems\n`);
        
        stats.total = cp31Problems.length;
        
        for (let i = 0; i < cp31Problems.length; i++) {
            const p = cp31Problems[i];
            await scrapeProblem(page, p.contestId, p.index);
            
            // Progress update every 20 problems
            if ((i + 1) % 20 === 0) {
                console.log(`\n   Progress: ${i + 1}/${cp31Problems.length} | Success: ${stats.success} | Skipped: ${stats.skipped}\n`);
                saveProgress();
            }
            
            await sleep(1500); // Rate limit
        }
        
        console.log('\n' + '=' .repeat(50));
        console.log('📊 CP31 PHASE COMPLETE:');
        console.log(`   Success: ${stats.success}`);
        console.log(`   Skipped: ${stats.skipped}`);
        console.log(`   Failed:  ${stats.failed}`);
        console.log('=' .repeat(50));
        
        saveProgress();
        
        // --- PHASE 2: Latest Problems ---
        console.log('\n📚 PHASE 2: Scraping Latest Problems...\n');
        
        const allProblems = await fetchAllProblems();
        
        // Sort by contest ID descending (newest first)
        allProblems.sort((a, b) => b.contestId - a.contestId);
        
        // Filter out CP31 problems (already scraped)
        const cp31Set = new Set(cp31Problems.map(p => `${p.contestId}_${p.index}`));
        const latestProblems = allProblems.filter(p => !cp31Set.has(`${p.contestId}_${p.index}`));
        
        console.log(`   Found ${latestProblems.length} additional problems to scrape\n`);
        
        // Reset stats for phase 2
        const phase1Stats = { ...stats };
        stats.total = latestProblems.length;
        stats.success = 0;
        stats.failed = 0;
        stats.skipped = 0;
        stats.failedProblems = [];
        
        for (let i = 0; i < latestProblems.length; i++) {
            const p = latestProblems[i];
            await scrapeProblem(page, p.contestId, p.index);
            
            if ((i + 1) % 50 === 0) {
                console.log(`\n   Progress: ${i + 1}/${latestProblems.length} | Success: ${stats.success} | Skipped: ${stats.skipped}\n`);
                saveProgress();
            }
            
            await sleep(1500);
        }
        
        // Final stats
        console.log('\n' + '=' .repeat(50));
        console.log('📊 FINAL RESULTS:');
        console.log(`   CP31 Success: ${phase1Stats.success}`);
        console.log(`   Latest Success: ${stats.success}`);
        console.log(`   Total Files: ${fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.html')).length}`);
        console.log('=' .repeat(50));
        
    } finally {
        saveProgress();
        await browser.close();
    }
    
    // List failed problems
    if (stats.failedProblems.length > 0) {
        console.log('\n❌ Failed problems saved to scrape_progress.json');
    }
};

main().catch(console.error);
