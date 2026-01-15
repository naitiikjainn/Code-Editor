/**
 * Intercept A2Z API calls to get problem data
 * 
 * This script monitors network traffic to capture the API responses
 * 
 * Usage: node scripts/intercept_a2z_api.cjs
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const A2Z_URL = 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2';

async function interceptA2ZAPI() {
    console.log('🚀 Intercepting A2Z API calls...\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const apiResponses = [];
    
    try {
        const page = await browser.newPage();
        
        // Set viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Enable request interception
        await page.setRequestInterception(true);
        
        // Capture all API responses
        page.on('request', request => {
            request.continue();
        });
        
        page.on('response', async response => {
            const url = response.url();
            const contentType = response.headers()['content-type'] || '';
            
            // Look for JSON API responses that might contain problem data
            if (contentType.includes('application/json') || url.includes('api') || url.includes('graphql')) {
                try {
                    const data = await response.json();
                    apiResponses.push({
                        url: url,
                        data: data
                    });
                    console.log(`📡 Captured API response from: ${url.substring(0, 100)}...`);
                } catch (e) {
                    // Not JSON, skip
                }
            }
        });

        console.log('📄 Loading page...');
        await page.goto(A2Z_URL, { waitUntil: 'networkidle0', timeout: 90000 });

        // Wait for initial content
        await new Promise(r => setTimeout(r, 5000));

        // Click on all accordion triggers to load all data
        const triggerCount = await page.$$eval('[data-slot="accordion-trigger"]', items => items.length);
        console.log(`\n📁 Found ${triggerCount} accordion triggers, clicking each one...\n`);

        for (let i = 0; i < triggerCount; i++) {
            try {
                const triggers = await page.$$('[data-slot="accordion-trigger"]');
                if (triggers[i]) {
                    await triggers[i].click();
                    await new Promise(r => setTimeout(r, 2000)); // Wait for API call
                    console.log(`  Clicked trigger ${i + 1}/${triggerCount}`);
                }
            } catch (e) {
                console.log(`  Error clicking trigger ${i + 1}: ${e.message}`);
            }
        }

        // Wait for all API calls to complete
        await new Promise(r => setTimeout(r, 5000));

        console.log(`\n📊 Captured ${apiResponses.length} API responses\n`);

        // Save all captured API responses
        const outputPath = path.join(__dirname, 'a2z_api_responses.json');
        fs.writeFileSync(outputPath, JSON.stringify(apiResponses, null, 2));
        console.log(`💾 Saved API responses to: ${outputPath}`);

        // Also look for data embedded in the page (Next.js style)
        console.log('\n🔍 Looking for embedded data in page...');
        
        const pageData = await page.evaluate(() => {
            // Check for Next.js data
            const nextDataScript = document.querySelector('#__NEXT_DATA__');
            if (nextDataScript) {
                return { type: 'next_data', data: JSON.parse(nextDataScript.textContent) };
            }
            
            // Check for window data
            if (window.__NUXT__) {
                return { type: 'nuxt', data: window.__NUXT__ };
            }
            
            // Check for any global data
            if (window.INITIAL_STATE) {
                return { type: 'initial_state', data: window.INITIAL_STATE };
            }
            
            // Look for any script tags with JSON data
            const scripts = document.querySelectorAll('script[type="application/json"]');
            if (scripts.length > 0) {
                return { type: 'json_scripts', data: Array.from(scripts).map(s => JSON.parse(s.textContent)) };
            }
            
            return null;
        });

        if (pageData) {
            console.log(`Found ${pageData.type} embedded data!`);
            const embeddedPath = path.join(__dirname, 'a2z_embedded_data.json');
            fs.writeFileSync(embeddedPath, JSON.stringify(pageData, null, 2));
            console.log(`💾 Saved embedded data to: ${embeddedPath}`);
        }

        // Let's also try to extract from the DOM directly after everything is expanded
        console.log('\n🔍 Extracting visible data from DOM...');
        
        const domData = await page.evaluate(() => {
            const problems = [];
            
            // Try various selectors
            const selectors = [
                'table tbody tr',
                '[class*="problem"]',
                '[class*="row"]',
                'a[href*="leetcode.com"]',
                'a[href*="geeksforgeeks.org/problems"]',
                'a[href*="practice.geeksforgeeks.org"]'
            ];
            
            selectors.forEach(sel => {
                const elements = document.querySelectorAll(sel);
                elements.forEach(el => {
                    // Look for practice links
                    const links = el.querySelectorAll('a[href*="leetcode"], a[href*="geeksforgeeks"], a[href*="practice"]');
                    links.forEach(link => {
                        const href = link.href;
                        if (href && (href.includes('leetcode.com/problems') || 
                                    href.includes('geeksforgeeks.org/problems') ||
                                    href.includes('practice.geeksforgeeks.org'))) {
                            problems.push({
                                url: href,
                                text: link.textContent.trim(),
                                fullRow: el.textContent.substring(0, 200)
                            });
                        }
                    });
                });
            });
            
            return problems;
        });

        console.log(`Found ${domData.length} practice links in DOM`);
        if (domData.length > 0) {
            const domPath = path.join(__dirname, 'a2z_dom_data.json');
            fs.writeFileSync(domPath, JSON.stringify(domData, null, 2));
            console.log(`💾 Saved DOM data to: ${domPath}`);
        }

        // Take a final screenshot
        await page.screenshot({ path: 'a2z_final.png', fullPage: true });
        console.log('📸 Saved final screenshot: a2z_final.png');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await browser.close();
    }
}

interceptA2ZAPI().catch(console.error);
