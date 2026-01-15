/**
 * Scrape Complete A2Z DSA Sheet using Puppeteer
 * 
 * This script uses Puppeteer to render the page and extract all problems WITH practice links.
 * 
 * Usage: node scripts/scrape_full_a2z_puppeteer.cjs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const A2Z_URL = 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2';

async function scrapeA2Z() {
    console.log('🚀 Starting A2Z DSA Sheet Scraping with Puppeteer...\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Set viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('📄 Loading page...');
        await page.goto(A2Z_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for accordion items to load
        await page.waitForSelector('[data-slot="accordion-item"]', { timeout: 30000 });
        console.log('✅ Page loaded, found accordion items\n');

        // Get all topic accordions
        const topicCount = await page.$$eval('[data-slot="accordion-item"]', items => items.length);
        console.log(`📁 Found ${topicCount} topics\n`);

        const a2zData = [];
        let totalProblems = 0;
        let problemsWithLinks = 0;

        for (let i = 0; i < topicCount; i++) {
            // Re-query topics each iteration (DOM may change)
            const topics = await page.$$('[data-slot="accordion-item"]');
            const topic = topics[i];
            
            if (!topic) continue;

            // Get topic title before clicking
            const topicTitle = await topic.$eval('.tuf-accordion-title', el => el.textContent.trim()).catch(() => `Topic ${i + 1}`);
            
            // Click to expand the topic
            const triggerButton = await topic.$('[data-slot="accordion-trigger"]');
            if (triggerButton) {
                await triggerButton.click();
                await new Promise(r => setTimeout(r, 3000)); // Wait for content to load
            }

            // Take a debug screenshot for the first topic
            if (i === 0) {
                await page.screenshot({ path: 'debug_a2z.png', fullPage: true });
                console.log('📸 Debug screenshot saved: debug_a2z.png');
            }

            // Wait for problem rows to appear
            await new Promise(r => setTimeout(r, 1000));

            // Extract all problems from the expanded section using page.evaluate
            const problems = await page.evaluate((topicIndex) => {
                const items = document.querySelectorAll('[data-slot="accordion-item"]');
                const topic = items[topicIndex];
                if (!topic) return [];

                const results = [];
                
                // Look for problem rows - they usually have links to platforms
                const rows = topic.querySelectorAll('tr, [class*="problem-row"], [class*="tuf-problem"]');
                
                rows.forEach(row => {
                    // Find practice link (LeetCode, GFG, CodingNinjas)
                    const practiceLinks = row.querySelectorAll('a[href*="leetcode.com"], a[href*="geeksforgeeks.org/problems"], a[href*="codingninjas.com"], a[href*="practice.geeksforgeeks.org"]');
                    
                    if (practiceLinks.length > 0) {
                        const practiceLink = practiceLinks[0].href;
                        
                        // Get problem title - look for text content
                        const titleEl = row.querySelector('a, [class*="title"], td:first-child');
                        let title = titleEl ? titleEl.textContent.trim() : '';
                        
                        // Clean up title
                        title = title.replace(/^\d+\.\s*/, '').trim();
                        if (!title || title.length < 3) return;
                        
                        // Get difficulty
                        const difficultyEl = row.querySelector('[class*="difficulty"], [class*="Easy"], [class*="Medium"], [class*="Hard"]');
                        let difficulty = 'Medium';
                        if (difficultyEl) {
                            const text = difficultyEl.textContent.toLowerCase();
                            if (text.includes('easy')) difficulty = 'Easy';
                            else if (text.includes('hard')) difficulty = 'Hard';
                        }
                        
                        // Get video link
                        const videoLink = row.querySelector('a[href*="youtube.com"]');
                        
                        results.push({
                            title,
                            difficulty,
                            practiceLink,
                            videoLink: videoLink ? videoLink.href : ''
                        });
                    }
                });
                
                return results;
            }, i);

            // Create topic data
            const topicId = topicTitle.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');

            const topicData = {
                id: topicId,
                title: topicTitle,
                problems: []
            };

            for (const prob of problems) {
                totalProblems++;
                
                if (prob.practiceLink && prob.practiceLink.includes('http')) {
                    problemsWithLinks++;
                    
                    let platform = 'leetcode';
                    if (prob.practiceLink.includes('geeksforgeeks')) platform = 'geeksforgeeks';
                    else if (prob.practiceLink.includes('codingninjas')) platform = 'codingninjas';

                    topicData.problems.push({
                        id: `${topicId}-${topicData.problems.length + 1}`,
                        title: prob.title,
                        difficulty: prob.difficulty,
                        platform,
                        platformLink: prob.practiceLink,
                        videoLink: prob.videoLink || ''
                    });
                }
            }

            console.log(`📁 ${topicTitle}: ${topicData.problems.length} problems with links`);

            if (topicData.problems.length > 0) {
                a2zData.push(topicData);
            }
        }

        console.log(`\n📊 SUMMARY:`);
        console.log(`   Total problems found: ${totalProblems}`);
        console.log(`   Problems with practice links: ${problemsWithLinks}`);
        console.log(`   Topics with problems: ${a2zData.length}`);

        // Save to file
        const outputPath = path.join(__dirname, '../../frontend/src/components/a2z-full.json');
        fs.writeFileSync(outputPath, JSON.stringify(a2zData, null, 2));
        console.log(`\n💾 Saved to: ${outputPath}`);

        return a2zData;

    } catch (err) {
        console.error('Error:', err.message);
        console.error(err.stack);
    } finally {
        await browser.close();
    }
}

scrapeA2Z();
