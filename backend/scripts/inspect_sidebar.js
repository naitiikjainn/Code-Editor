import fetch from "node-fetch";

const url = "https://codeforces.com/contest/1890/problem/A";

async function run() {
    console.log(`Fetching ${url}...`);
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });
    const text = await res.text();

    // Check Title
    const titleMatch = text.match(/<title>(.*?)<\/title>/);
    console.log("Page Title:", titleMatch ? titleMatch[1] : "No Title");

    if (text.includes("Redirecting") || text.includes("Just a moment")) {
        console.log("⚠️ Access Denied / Redirecting");
        return;
    }

    // Look for "Tutorial"
    const tutorialIndex = text.indexOf("Tutorial");
    if (tutorialIndex !== -1) {
        console.log("Found 'Tutorial'!");
        console.log(text.substring(tutorialIndex - 200, tutorialIndex + 200));
    } else {
        console.log("'Tutorial' not found.");
    }
}
run();
