/**
 * Better A2Z Scraper - Extract problems with proper topic grouping
 * 
 * Usage: node scripts/scrape_a2z_better.cjs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const A2Z_URL = 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2';

async function scrapeA2Z() {
    console.log('🚀 Better A2Z Scraping...\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        console.log('📄 Loading page...');
        await page.goto(A2Z_URL, { waitUntil: 'networkidle0', timeout: 90000 });
        await new Promise(r => setTimeout(r, 5000));

        // Get all accordions and click them
        const topicCount = await page.$$eval('[data-slot="accordion-item"]', items => items.length);
        console.log(`📁 Found ${topicCount} topics\n`);

        const allProblems = [];

        for (let i = 0; i < topicCount; i++) {
            // Click accordion
            const triggers = await page.$$('[data-slot="accordion-trigger"]');
            if (triggers[i]) {
                await triggers[i].click();
                await new Promise(r => setTimeout(r, 2000));
            }

            // Get topic title from the accordion
            const topicTitle = await page.$$eval('[data-slot="accordion-item"]', (items, idx) => {
                const item = items[idx];
                const titleEl = item.querySelector('.tuf-accordion-title, [class*="title"]');
                return titleEl ? titleEl.textContent.trim() : `Topic ${idx + 1}`;
            }, i);

            // Extract problems from this accordion section
            const problems = await page.evaluate((topicIdx) => {
                const items = document.querySelectorAll('[data-slot="accordion-item"]');
                const accordion = items[topicIdx];
                if (!accordion) return [];

                const results = [];
                
                // Look for table rows within this accordion
                const rows = accordion.querySelectorAll('tbody tr');
                
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) return;
                    
                    // Problem title is usually in the 2nd cell
                    const titleCell = cells[1];
                    const problemTitle = titleCell ? titleCell.textContent.trim() : '';
                    
                    // Practice links are in one of the later cells
                    const allLinks = row.querySelectorAll('a[href*="leetcode.com/problems"], a[href*="geeksforgeeks.org/problems"], a[href*="practice.geeksforgeeks.org"]');
                    
                    if (allLinks.length === 0) return; // Skip if no practice link
                    
                    // Get the first valid practice link
                    let practiceUrl = '';
                    for (const link of allLinks) {
                        const href = link.href;
                        if (!href.includes('/discuss/')) {
                            practiceUrl = href;
                            break;
                        }
                    }
                    
                    if (!practiceUrl) return;
                    
                    // Difficulty - look for Easy/Medium/Hard text
                    const diffCell = cells[cells.length - 1] || cells[cells.length - 2];
                    const diffText = diffCell ? diffCell.textContent : '';
                    let difficulty = 'Medium';
                    if (diffText.toLowerCase().includes('easy')) difficulty = 'Easy';
                    if (diffText.toLowerCase().includes('hard')) difficulty = 'Hard';
                    
                    results.push({
                        title: problemTitle.replace(/^\d+\.?\s*/, '').trim(),
                        url: practiceUrl.replace('/description/', '/').split('#')[0].split('?')[0],
                        difficulty: difficulty
                    });
                });
                
                return results;
            }, i);

            // Add topic to each problem
            problems.forEach(p => {
                if (p.title && p.url) {
                    allProblems.push({
                        ...p,
                        topic: topicTitle
                    });
                }
            });

            console.log(`  ${topicTitle}: ${problems.length} problems`);
        }

        console.log(`\n📊 Total scraped: ${allProblems.length} problems`);

        // Deduplicate by URL
        const uniqueProblems = new Map();
        allProblems.forEach(p => {
            const key = p.url.replace(/\/$/, '');
            if (!uniqueProblems.has(key)) {
                uniqueProblems.set(key, p);
            }
        });

        console.log(`📊 Unique problems: ${uniqueProblems.size}`);

        // Group by topic
        const topicMap = new Map();
        uniqueProblems.forEach(p => {
            if (!topicMap.has(p.topic)) {
                topicMap.set(p.topic, []);
            }
            topicMap.get(p.topic).push(p);
        });

        // Create a2z.json format
        const a2zData = [];
        topicMap.forEach((problems, topic) => {
            a2zData.push({
                topic: topic,
                count: problems.length,
                problems: problems.map(p => {
                    // Create ID from title
                    const id = p.title.toLowerCase()
                        .replace(/[^a-z0-9\s]/g, '')
                        .replace(/\s+/g, '-');
                    
                    // Determine provider
                    let provider = 'LeetCode';
                    if (p.url.includes('geeksforgeeks')) provider = 'GFG';
                    if (p.url.includes('codingninjas')) provider = 'CodingNinjas';
                    
                    return {
                        id: id || `problem-${Math.random().toString(36).substr(2, 9)}`,
                        title: p.title,
                        url: p.url,
                        provider: provider,
                        difficulty: p.difficulty
                    };
                })
            });
        });

        // Save
        const outputPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'a2z.json');
        fs.writeFileSync(outputPath, JSON.stringify(a2zData, null, 2));
        console.log(`\n💾 Saved to: ${outputPath}`);

        // Print summary
        console.log('\n📁 Topic breakdown:');
        a2zData.forEach(t => {
            console.log(`  ${t.topic}: ${t.count} problems`);
        });

        // Save raw data for debugging
        const rawPath = path.join(__dirname, 'a2z_scraped_raw.json');
        fs.writeFileSync(rawPath, JSON.stringify(Array.from(uniqueProblems.values()), null, 2));
        console.log(`\n💾 Raw data saved to: ${rawPath}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await browser.close();
    }
}

scrapeA2Z().catch(console.error);
