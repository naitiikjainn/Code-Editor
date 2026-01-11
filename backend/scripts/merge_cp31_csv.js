
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_PATH = "c:\\Users\\Admin\\.gemini\\new_cp31.csv";
const JSON_PATH = path.join(__dirname, "../../frontend/src/components/cp31.json");

// Helper to delay (avoid rate limits)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchProblemDetails(contestId, index) {
    try {
        // Fetch from Codeforces API (Official)
        // We can fetch the list once or fetch individually if list is too big? 
        // Better: Fetch all problems once and lookup locally to save requests.
        // But for now let's try individual or rely on a "getAllProblems" fetch first.
        return null; // Placeholder
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log("Reading CSV...");
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim());

    const headers = lines[0].split(',').map(h => h.trim());
    const ratingMap = {}; // { 800: [...], 900: [...] }

    headers.forEach((h, i) => {
        if (h) ratingMap[h] = [];
    });

    console.log(`Found ratings: ${Object.keys(ratingMap).join(', ')}`);

    // Parse Rows
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim()); // Simple split, assuming no commas in titles/urls

        cols.forEach((cell, colIdx) => {
            const rating = headers[colIdx];
            if (!rating || !cell) return;

            let contestId = null;
            let index = null;
            let url = null;

            // Type A: URL "https://codeforces.com/problemset/problem/1920/C"
            const urlMatch = cell.match(/problem\/(\d+)\/([A-Z0-9]+)/i);
            if (urlMatch) {
                contestId = urlMatch[1];
                index = urlMatch[2];
                url = cell;
            }
            // Type B: Text "Problem - 1903A - Codeforces"
            else {
                const textMatch = cell.match(/Problem - (\d+)([A-Z0-9]+) - Codeforces/i);
                if (textMatch) {
                    contestId = textMatch[1];
                    index = textMatch[2];
                    url = `https://codeforces.com/problemset/problem/${contestId}/${index}`;
                }
            }

            if (contestId && index) {
                ratingMap[rating].push({ contestId, index, url, rating });
            }
        });
    }

    // Load Existing JSON
    let cp31 = {};
    if (fs.existsSync(JSON_PATH)) {
        cp31 = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    }

    // Fetch Global Problem List to lookup names/tags efficiently
    console.log("Fetching global problem list from Codeforces...");
    const res = await fetch("https://codeforces.com/api/problemset.problems");
    const data = await res.json();
    if (data.status !== "OK") throw new Error("Failed to fetch CF problems");

    // Map of "1234A" -> { name, tags }
    const problemLookup = new Map();
    data.result.problems.forEach(p => {
        problemLookup.set(`${p.contestId}${p.index}`, p);
    });

    let addedCount = 0;

    // Merge
    for (const rating of Object.keys(ratingMap)) {
        if (!cp31[rating]) cp31[rating] = [];

        const existingIds = new Set(cp31[rating].map(p => `${p.contestId}${p.index}`));

        for (const item of ratingMap[rating]) {
            const id = `${item.contestId}${item.index}`;
            if (!existingIds.has(id)) {
                // Lookup Details
                const details = problemLookup.get(id);
                if (details) {
                    const newEntry = {
                        contestId: parseInt(item.contestId),
                        index: item.index,
                        rating: rating,
                        url: item.url,
                        name: details.name,
                        tags: details.tags
                    };
                    cp31[rating].push(newEntry);
                    addedCount++;
                    process.stdout.write(`+ ${id} `);
                    existingIds.add(id);
                } else {
                    console.warn(`\nWarning: Problem ${id} not found in Codeforces API list.`);
                }
            }
        }
    }

    console.log(`\n\nAdded ${addedCount} new problems.`);

    // Write Back
    fs.writeFileSync(JSON_PATH, JSON.stringify(cp31, null, 4));
    console.log("Updated cp31.json successfully.");
}

main().catch(console.error);
