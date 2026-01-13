import fetch from "node-fetch";

// Helper to clean Codeforces HTML inputs (Paranoid Backend Version)
const cleanCFText = (html) => {
    if (!html) return "";
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]*>/g, "") // Strip remaining tags
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n") // Normalize newlines
        .trim();
};

export const fetchCodeforcesProblem = async (contestId, index) => {
    const urls = [
        `https://codeforces.com/contest/${contestId}/problem/${index}`,
        `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    ];

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1",
        "Cookie": "f=1" // Forces full version? helpful sometimes
    };

    let lastError = null;

    for (const url of urls) {
        try {
            console.log(`[CF Scraper] Trying ${url}...`);
            if (urls.indexOf(url) > 0) await new Promise(r => setTimeout(r, 500));

            const response = await fetch(url, { headers });

            if (!response.ok) {
                if (response.status === 404) throw new Error("Problem not found (404)");
                throw new Error(`Status ${response.status}`);
            }

            const text = await response.text();

            if (text.includes("Redirecting") || text.includes("Just a moment") || text.includes("security check") || text.includes("Enter »")) {
                throw new Error("Anti-Bot Protection or Contest Entry Page");
            }

            // Fix relative URLs
            const baseUrl = new URL(url).origin;
            const fixedText = text.replace(/src="\//g, `src="${baseUrl}/`);

            // Extract Title
            let title = `${contestId}${index}`;
            const titleDivMatch = fixedText.match(/<div class="title">([^<]*)<\/div>/);
            const titleTagMatch = fixedText.match(/<title>(.*?)<\/title>/);

            if (titleDivMatch) {
                title = titleDivMatch[1].trim();
            } else if (titleTagMatch) {
                title = titleTagMatch[1].replace(" - Codeforces", "").trim();
            }

            // Extract Description
            let description = "<p>No description available.</p>";
            const startMarker = '<div class="problem-statement">';
            const endMarker = '<div class="sample-tests">';

            const startIndex = fixedText.indexOf(startMarker);
            if (startIndex !== -1) {
                const endIndex = fixedText.indexOf(endMarker, startIndex);
                if (endIndex !== -1) {
                    description = `<div>${fixedText.substring(startIndex, endIndex)}</div>`;
                } else {
                    const noteIndex = fixedText.indexOf('<div class="note">', startIndex);
                    if (noteIndex !== -1) {
                        description = fixedText.substring(startIndex, noteIndex) + "</div>";
                    } else {
                        description = fixedText.substring(startIndex, startIndex + 6000) + "...</div>";
                    }
                }
            }

            // Inputs/Outputs
            const inputs = [];
            const outputs = [];

            const inputRegex = /<div class="input">[\s\S]*?<pre>([\s\S]*?)<\/pre>/g;
            const outputRegex = /<div class="output">[\s\S]*?<pre>([\s\S]*?)<\/pre>/g;

            let match;
            while ((match = inputRegex.exec(fixedText)) !== null) {
                inputs.push(cleanCFText(match[1]));
            }
            while ((match = outputRegex.exec(fixedText)) !== null) {
                outputs.push(cleanCFText(match[1]));
            }

            const testCases = inputs.map((inp, i) => ({
                input: inp,
                expectedOutput: outputs[i] || ""
            }));

            return {
                provider: "codeforces",
                id: `${contestId}${index}`,
                title: title,
                url: url,
                description: description,
                testCases: testCases
            };

        } catch (err) {
            console.warn(`[CF Scraper] Failed ${url}: ${err.message}`);
            lastError = err;
        }
    }

    throw new Error(`Failed to fetch Codeforces problem. Last error: ${lastError?.message}`);
};
