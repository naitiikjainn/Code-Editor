/**
 * Fetch Complete A2Z DSA Sheet from TakeUForward
 * 
 * This script fetches all 455 problems from the A2Z DSA Sheet
 * and saves them to a2z.json
 */

const fs = require('fs');
const path = require('path');

const A2Z_API = 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2';

async function fetchA2ZSheet() {
    console.log('🚀 Fetching complete A2Z DSA Sheet from TakeUForward...\n');

    try {
        // Fetch the page
        const res = await fetch(A2Z_API, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });

        const html = await res.text();
        
        // Try to find Next.js data
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        
        if (nextDataMatch) {
            const nextData = JSON.parse(nextDataMatch[1]);
            console.log('Found Next.js data!');
            
            // The structure varies, let's explore
            const pageProps = nextData?.props?.pageProps;
            console.log('PageProps keys:', Object.keys(pageProps || {}));
            
            if (pageProps?.data) {
                console.log('Data structure found!');
                fs.writeFileSync('a2z_raw_data.json', JSON.stringify(pageProps.data, null, 2));
                console.log('Saved raw data to a2z_raw_data.json');
            }
        }

        // Also try to find embedded JSON data in script tags
        const scriptDataMatch = html.match(/window\.__INITIAL_DATA__\s*=\s*(\{[\s\S]*?\});/);
        if (scriptDataMatch) {
            console.log('Found window.__INITIAL_DATA__');
        }

        // Save HTML for analysis
        fs.writeFileSync('a2z_page.html', html);
        console.log('Saved HTML to a2z_page.html for analysis');

    } catch (err) {
        console.error('Error:', err.message);
    }
}

// Alternative: Use the TUF API directly
async function fetchFromTUFAPI() {
    console.log('\n🔄 Trying TakeUForward API...\n');
    
    const apiEndpoints = [
        'https://takeuforward.org/api/sheets/strivers-a2z-dsa-course-sheet-2',
        'https://api.takeuforward.org/api/sheets/strivers-a2z-dsa-course-sheet-2',
        'https://takeuforward.org/api/content/strivers-a2z-dsa-course-sheet-2'
    ];

    for (const url of apiEndpoints) {
        try {
            console.log(`Trying: ${url}`);
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                console.log('✅ Success! Keys:', Object.keys(data));
                fs.writeFileSync('a2z_api_data.json', JSON.stringify(data, null, 2));
                return data;
            }
        } catch (err) {
            console.log(`  ❌ Failed: ${err.message}`);
        }
    }
    
    return null;
}

// Main
async function main() {
    await fetchA2ZSheet();
    await fetchFromTUFAPI();
    
    console.log('\n📋 Check the output files for the data structure');
}

main();
