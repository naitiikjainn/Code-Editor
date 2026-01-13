/**
 * Simple batch scraper - scrapes problems in small batches
 * More reliable than continuous scraping
 * 
 * Usage: node scrape_batch.js [start] [count]
 * Example: node scrape_batch.js 0 50  (scrape first 50 CP31 problems)
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

// Load CP31 problems
const loadCP31 = () => {
    const data = JSON.parse(fs.readFileSync(CP31_PATH, 'utf-8'));
    const problems = [];
    Object.values(data).forEach(arr => {
        arr.forEach(p => problems.push({ contestId: p.contestId, index: p.index }));
    });
    return problems;
};

const scrapeProblem = async (page, contestId, index) => {
    const problemId = `${contestId}_${index}`;
    const outputPath = path.join(OUTPUT_DIR, `${problemId}.html`);
    
    if (fs.existsSync(outputPath)) {
        console.log(`⏭️  ${problemId} (exists)`);
        return 'skipped';
    }
    
    const urls = [
        `https://codeforces.com/contest/${contestId}/problem/${index}`,
        `https://codeforces.com/problemset/problem/${contestId}/${index}`
    ];
    
    for (const url of urls) {
        try {
            console.log(`📥 ${problemId}...`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // Wait longer for Cloudflare
            await sleep(2000);
            
            // Check for problem statement
            const hasContent = await page.evaluate(() => {
                return document.querySelector('.problem-statement') !== null;
            });
            
            if (!hasContent) {
                // Wait more for Cloudflare
                await sleep(5000);
                await page.waitForSelector('.problem-statement', { timeout: 30000 });
            }
            
            const html = await page.content();
            
            if (html.includes('problem-statement') && !html.includes('Just a moment')) {
                fs.writeFileSync(outputPath, html, 'utf-8');
                console.log(`   ✅ Saved!`);
                return 'success';
            }
        } catch (e) {
            console.log(`   ⚠️ ${e.message.slice(0, 50)}`);
        }
    }
    
    console.log(`   ❌ Failed`);
    return 'failed';
};

const main = async () => {
    const args = process.argv.slice(2);
    const start = parseInt(args[0]) || 0;
    const count = parseInt(args[1]) || 50;
    
    const cp31 = loadCP31();
    const batch = cp31.slice(start, start + count);
    
    console.log(`\n🚀 Scraping CP31 problems ${start} to ${start + count - 1}`);
    console.log(`   (${batch.length} problems in this batch)\n`);
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    let success = 0, failed = 0, skipped = 0;
    
    for (const p of batch) {
        const result = await scrapeProblem(page, p.contestId, p.index);
        if (result === 'success') success++;
        else if (result === 'failed') failed++;
        else skipped++;
        
        await sleep(2000);
    }
    
    await browser.close();
    
    console.log(`\n${'='.repeat(40)}`);
    console.log(`✅ Success: ${success}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Failed:  ${failed}`);
    console.log(`📁 Total files: ${fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.html')).length}`);
};

main().catch(console.error);
