const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        console.log('Browser launched');
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        console.log('Going to search page...');
        await page.goto('https://codeforces.com/search?query=Round%201072%20Editorial', { 
            waitUntil: 'domcontentloaded', 
            timeout: 20000 
        });
        
        console.log('Waiting for results...');
        await page.waitForSelector('.datatable, .searchResultsList', { timeout: 5000 }).catch(() => console.log('No datatable found'));
        
        const links = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('a[href*="/blog/entry/"]').forEach(a => {
                const text = a.textContent.toLowerCase();
                if (text.includes('1072') || text.includes('editorial') || text.includes('tutorial')) {
                    results.push({
                        text: a.textContent.substring(0, 100).trim(),
                        href: a.href
                    });
                }
            });
            return results;
        });
        
        console.log('Found links:', links.length);
        links.slice(0, 5).forEach(l => console.log(' -', l.text, '\n   ', l.href));
        
        await browser.close();
        console.log('Done');
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
