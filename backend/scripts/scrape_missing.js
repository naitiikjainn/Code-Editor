/**
 * Scrape only missing CP31 problems
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'codeforces-problems', 'content');
const CP31_PATH = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'cp31.json');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Get missing problems
const getMissing = () => {
    const cp31Data = JSON.parse(fs.readFileSync(CP31_PATH, 'utf-8'));
    const existing = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.html')).map(f => f.replace('.html', ''));
    
    const allProblems = [];
    for (const rating in cp31Data) {
        cp31Data[rating].forEach(p => allProblems.push({ contestId: p.contestId, index: p.index }));
    }
    
    return allProblems.filter(p => !existing.includes(`${p.contestId}_${p.index}`));
};

const scrapeProblem = async (page, contestId, index) => {
    const problemId = `${contestId}_${index}`;
    const outputPath = path.join(OUTPUT_DIR, `${problemId}.html`);
    
    const urls = [
        `https://codeforces.com/contest/${contestId}/problem/${index}`,
        `https://codeforces.com/problemset/problem/${contestId}/${index}`
    ];
    
    for (const url of urls) {
        try {
            console.log(`📥 ${problemId}...`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // Wait longer for Cloudflare
            await sleep(3000);
            
            // Check for problem statement
            const hasContent = await page.evaluate(() => {
                return document.querySelector('.problem-statement') !== null;
            });
            
            if (!hasContent) {
                // Wait more for Cloudflare
                await sleep(5000);
                try {
                    await page.waitForSelector('.problem-statement', { timeout: 30000 });
                } catch (e) {
                    console.log(`   ⚠️ Timeout waiting for content`);
                    continue;
                }
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
    const missing = getMissing();
    console.log(`\n🚀 Found ${missing.length} missing CP31 problems\n`);
    
    if (missing.length === 0) {
        console.log('✅ All CP31 problems downloaded!');
        return;
    }
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    let success = 0, failed = 0;
    
    for (let i = 0; i < missing.length; i++) {
        const { contestId, index } = missing[i];
        console.log(`\n[${i + 1}/${missing.length}]`);
        
        const result = await scrapeProblem(page, contestId, index);
        if (result === 'success') success++;
        else if (result === 'failed') failed++;
        
        // Delay between requests
        await sleep(2000);
    }
    
    await browser.close();
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Success: ${success}`);
    console.log(`   ❌ Failed: ${failed}`);
};

main().catch(console.error);
