/**
 * Editorial Scraper
 * Scrapes Codeforces editorials for problems
 * 
 * Editorial URLs:
 * - Official: https://codeforces.com/blog/entry/{blogId}
 * - From contest page: linked in announcement
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'codeforces-problems', 'editorials');
const PROGRESS_FILE = path.join(__dirname, '..', '..', 'codeforces-problems', 'editorial_progress.json');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load progress
const loadProgress = () => {
    if (fs.existsSync(PROGRESS_FILE)) {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
    return { editorials: {} };
};

const saveProgress = (progress) => {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
};

// Find editorial link from contest page
const findEditorialLink = async (page, contestId) => {
    try {
        // Try contest page first
        await page.goto(`https://codeforces.com/contest/${contestId}`, { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
        });
        await sleep(2000);
        
        // Look for editorial link in the sidebar or announcements
        const editorialLink = await page.evaluate(() => {
            // Check sidebar
            const links = Array.from(document.querySelectorAll('a'));
            for (const link of links) {
                const text = link.textContent.toLowerCase();
                if (text.includes('editorial') || text.includes('tutorial') || text.includes('разбор')) {
                    return link.href;
                }
            }
            return null;
        });
        
        return editorialLink;
    } catch (e) {
        return null;
    }
};

// Scrape editorial content
const scrapeEditorial = async (page, contestId) => {
    const outputPath = path.join(OUTPUT_DIR, `${contestId}.html`);
    
    if (fs.existsSync(outputPath)) {
        console.log(`⏭️  ${contestId} (exists)`);
        return 'exists';
    }
    
    console.log(`📥 Contest ${contestId}...`);
    
    // Find editorial link
    const editorialUrl = await findEditorialLink(page, contestId);
    
    if (!editorialUrl) {
        console.log(`   ⚠️ No editorial found`);
        return 'not_found';
    }
    
    console.log(`   📎 Found: ${editorialUrl}`);
    
    try {
        await page.goto(editorialUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000);
        
        // Extract blog content
        const content = await page.evaluate(() => {
            const blog = document.querySelector('.content');
            if (blog) {
                return blog.innerHTML;
            }
            return null;
        });
        
        if (content && content.length > 500) {
            // Wrap in proper HTML
            const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Editorial - Contest ${contestId}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
        pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 5px; }
        img { max-width: 100%; }
        .spoiler { background: #eee; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>Editorial - Contest ${contestId}</h1>
    <p><a href="${editorialUrl}" target="_blank">Original on Codeforces</a></p>
    <hr>
    ${content}
</body>
</html>`;
            
            fs.writeFileSync(outputPath, html, 'utf-8');
            console.log(`   ✅ Saved!`);
            return 'success';
        } else {
            console.log(`   ⚠️ Content too short or not found`);
            return 'not_found';
        }
    } catch (e) {
        console.log(`   ❌ Error: ${e.message.slice(0, 50)}`);
        return 'error';
    }
};

// Main
const main = async () => {
    const args = process.argv.slice(2);
    const startContest = parseInt(args[0]) || 2100;
    const count = parseInt(args[1]) || 50;
    
    console.log(`\n🚀 Scraping editorials from contest ${startContest} (${count} contests)\n`);
    
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    let progress = loadProgress();
    let success = 0, notFound = 0;
    
    for (let i = 0; i < count; i++) {
        const contestId = startContest - i;
        const result = await scrapeEditorial(page, contestId);
        
        if (result === 'success') {
            success++;
            progress.editorials[contestId] = true;
        } else if (result === 'not_found') {
            notFound++;
        }
        
        saveProgress(progress);
        await sleep(2000);
    }
    
    await browser.close();
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Success: ${success}`);
    console.log(`   ⚠️ Not found: ${notFound}`);
};

main().catch(console.error);
