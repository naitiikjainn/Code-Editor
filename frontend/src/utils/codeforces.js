
// Helper to clean Codeforces HTML inputs (Legacy - unused in main path but kept)
const cleanCFText = (html) => {
    if (!html) return "";
    return html.replace(/<br[^>]*>/gi, "\n").replace(/<[^>]*>/g, "").trim();
};

export const parseCodeforcesProblem = (html, contestId, index) => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // --- TITLE ---
        let title = `${contestId}${index}`;
        const titleNode = doc.querySelector(".problem-statement .header .title");
        if (titleNode) {
            title = titleNode.textContent.trim();
        }

        // --- METADATA (Time/Memory) ---
        let timeLimit = "N/A";
        let memoryLimit = "N/A";
        const timeNode = doc.querySelector(".time-limit");
        if (timeNode) {
            timeLimit = timeNode.textContent.replace("time limit per test", "").trim();
        }
        const memNode = doc.querySelector(".memory-limit");
        if (memNode) {
            memoryLimit = memNode.textContent.replace("memory limit per test", "").trim();
        }

        // --- DESCRIPTION & NOTE ---
        const problemStatement = doc.querySelector(".problem-statement");
        let description = "<p>No description available.</p>";
        let note = null;

        if (problemStatement) {
            const clone = problemStatement.cloneNode(true);

            // Remove header
            const header = clone.querySelector(".header");
            if (header) header.remove();

            // Remove sample tests from description view
            const samples = clone.querySelector(".sample-tests");
            if (samples) samples.remove();

            // Extract and Remove Note
            const noteNode = clone.querySelector(".note");
            if (noteNode) {
                note = noteNode.innerHTML;
                noteNode.remove();
            }

            // Fix images to be absolute
            clone.querySelectorAll("img").forEach(img => {
                const src = img.getAttribute("src");
                if (src && src.startsWith("/")) {
                    img.setAttribute("src", `https://codeforces.com${src}`);
                }
            });

            description = clone.innerHTML;
        }

        // --- TEST CASES ---
        const testCases = [];
        const inputPres = doc.querySelectorAll(".sample-tests .input pre");
        const outputPres = doc.querySelectorAll(".sample-tests .output pre");

        const processPre = (pre) => {
            if (!pre) return "";

            // Log raw HTML for debugging
            console.log("[CF Parser] Raw PRE HTML:", pre.innerHTML);

            let result = "";
            let lastWasBlock = false;

            const parseNode = (node) => {
                // Text Node: 3
                if (node.nodeType === 3) {
                    const text = node.textContent; // Don't trim yet, pre content matters
                    if (text) {
                        result += text;
                        lastWasBlock = false;
                    }
                }
                // Element Node: 1
                else if (node.nodeType === 1) {
                    const tag = node.tagName;

                    if (tag === "BR") {
                        result += "\n";
                        lastWasBlock = true;
                    }
                    else if (["DIV", "P", "LI", "TR"].includes(tag)) {
                        // Block Element
                        if (!lastWasBlock && result.length > 0 && !result.endsWith("\n")) {
                            result += "\n"; // Ensure break before
                        }

                        node.childNodes.forEach(parseNode);

                        if (!result.endsWith("\n")) {
                            result += "\n"; // Ensure break after
                        }
                        lastWasBlock = true;
                    }
                    else {
                        // Inline (span, b, code, etc.)
                        node.childNodes.forEach(parseNode);
                        lastWasBlock = false;
                    }
                }
            };

            pre.childNodes.forEach(parseNode);

            // Cleanup: reduce 3+ newlines to 2, trim start/end
            const final = result.replace(/\n{3,}/g, "\n\n").trim();
            console.log("[CF Parser] Parsed Result:", final);
            return final;
        };

        inputPres.forEach((inp, i) => {
            testCases.push({
                input: processPre(inp),
                expectedOutput: outputPres[i] ? processPre(outputPres[i]) : ""
            });
        });

        return {
            provider: "codeforces",
            id: `${contestId}${index}`,
            contestId,
            index,
            title,
            timeLimit,
            memoryLimit,
            description,
            note,
            testCases,
            url: `https://codeforces.com/contest/${contestId}/problem/${index}`
        };

    } catch (e) {
        console.error("Parse Error", e);
        return {
            provider: "codeforces",
            id: `${contestId}${index}`,
            title: `${contestId}${index}`,
            description: "Failed to parse problem content. " + e.message,
            testCases: [],
            url: `https://codeforces.com/contest/${contestId}/problem/${index}`
        };
    }
};
