/**
 * Scrape Single Problem
 * 
 * Quick script to scrape a single Codeforces problem and save it locally.
 * Useful for adding missing problems one at a time.
 * 
 * Usage:
 *   node scrape_single_problem.js 2052 M
 *   node scrape_single_problem.js 1890 A
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'codeforces-problems', 'content');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

const fetchProblem = async (contestId, index) => {
    const urls = [
        `https://codeforces.com/contest/${contestId}/problem/${index}`,
        `https://codeforces.com/problemset/problem/${contestId}/${index}`,
        `https://m.codeforces.com/contest/${contestId}/problem/${index}`
    ];
    
    for (const url of urls) {
        console.log(`📥 Trying ${url}...`);
        
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            
            if (response.status === 403) {
                console.log('   ⚠️  403 Forbidden (Cloudflare)');
                await sleep(3000);
                continue;
            }
            
            if (response.status === 404) {
                console.log('   ⚠️  404 Not Found');
                continue;
            }
            
            if (!response.ok) {
                console.log(`   ⚠️  HTTP ${response.status}`);
                continue;
            }
            
            const html = await response.text();
            
            // Check for Cloudflare challenge
            if (html.includes('Just a moment') || html.includes('Checking your browser')) {
                console.log('   ⚠️  Cloudflare challenge page');
                await sleep(3000);
                continue;
            }
            
            // Check for valid problem content
            if (!html.includes('problem-statement')) {
                console.log('   ⚠️  No problem-statement found');
                continue;
            }
            
            console.log(`   ✅ Success! (${html.length} bytes)`);
            return html;
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            await sleep(2000);
        }
    }
    
    return null;
};

const main = async () => {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node scrape_single_problem.js <contestId> <index>');
        console.log('Example: node scrape_single_problem.js 2052 M');
        process.exit(1);
    }
    
    const contestId = args[0];
    const index = args[1].toUpperCase();
    const problemId = `${contestId}_${index}`;
    
    console.log(`\n🎯 Scraping problem ${problemId}...\n`);
    
    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const outputPath = path.join(OUTPUT_DIR, `${problemId}.html`);
    
    // Check if already exists
    if (fs.existsSync(outputPath)) {
        console.log(`⚠️  File already exists: ${outputPath}`);
        const answer = await new Promise(resolve => {
            process.stdout.write('Overwrite? (y/N): ');
            process.stdin.once('data', data => resolve(data.toString().trim().toLowerCase()));
        });
        
        if (answer !== 'y') {
            console.log('Cancelled.');
            process.exit(0);
        }
    }
    
    const html = await fetchProblem(contestId, index);
    
    if (!html) {
        console.log('\n❌ Failed to scrape problem.');
        console.log('\n💡 Tips:');
        console.log('   - Codeforces may be blocking your IP (Cloudflare)');
        console.log('   - Try again later or from a different network');
        console.log('   - Use a VPN or residential IP');
        console.log('   - The problem may not exist yet');
        process.exit(1);
    }
    
    // Save
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`\n✅ Saved to: ${outputPath}`);
    
    console.log('\n📤 To upload to GitHub:');
    console.log('   cd codeforces-problems');
    console.log('   git add -A');
    console.log(`   git commit -m "Add problem ${problemId}"`);
    console.log('   git push');
};

main().catch(console.error);
