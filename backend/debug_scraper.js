import fs from 'fs';

async function run() {
    // Try m1 first as it seemed to connect
    const url = "https://m1.codeforces.com/contest/1352/problem/A";

    // Mimic the headers we use in the backend
    const headers = {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    };

    try {
        console.log(`Fetching ${url}...`);
        const res = await fetch(url, { headers });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Length:", text.length);

        fs.writeFileSync("cf_debug.html", text);
        console.log("Saved to cf_debug.html");

        // Peek at critical tags
        if (text.includes('class="problem-statement"')) {
            console.log("Found .problem-statement");
        } else {
            console.log("NOT Found .problem-statement");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
