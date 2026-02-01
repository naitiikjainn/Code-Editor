
// Helper to clean Codeforces HTML inputs (Legacy - unused in main path but kept)
const cleanCFText = (html) => {
    if (!html) return "";
    return html.replace(/<br[^>]*>/gi, "\n").replace(/<[^>]*>/g, "").trim();
};

const sanitizeProblemHtml = (html) => {
    if (!html) return html;
    return html
    .replace(/\\color\{white\}\{\\texttt\{[\s\S]*?\}\}/gi, "")
        .replace(/\\color\{white\}\{[\s\S]*?\}/gi, "")
        .replace(/if you are\s+llm[^<]*/gi, "")
        .replace(/take your answer by modulo[^<]*/gi, "");
};

export const parseCodeforcesProblem = (html, contestId, index) => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const normalizeMathJax = (root) => {
            if (!root) return;

            // Convert MathJax script tags to inline LaTeX
            root.querySelectorAll('script[type*="math/tex"]').forEach(script => {
                const tex = script.textContent || "";
                const type = (script.getAttribute("type") || "").toLowerCase();
                const latex = type.includes("mode=display") ? `$$${tex}$$` : `$${tex}$`;
                script.replaceWith(doc.createTextNode(latex));
            });

            // Remove MathJax rendered output spans
            root.querySelectorAll(
                '.MathJax, .MathJax_Preview, .MathJax_SVG, .MathJax_CHTML, .MJX_Assistive_MathML, [class^="mjx-"], [class*=" mjx-"]'
            ).forEach(node => node.remove());
        };

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
                normalizeMathJax(noteNode);
                note = sanitizeProblemHtml(noteNode.innerHTML);
                noteNode.remove();
            }

            // Fix images to be absolute
            clone.querySelectorAll("img").forEach(img => {
                const src = img.getAttribute("src");
                if (src && src.startsWith("/")) {
                    img.setAttribute("src", `https://codeforces.com${src}`);
                }
            });

            // Normalize math in the remaining statement
            normalizeMathJax(clone);

            description = sanitizeProblemHtml(clone.innerHTML);
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


        // --- TUTORIAL URL ---
        let tutorialUrl = null;
        try {
            const sideboxes = doc.querySelectorAll(".sidebox");
            for (const box of sideboxes) {
                const caption = box.querySelector(".caption");
                if (caption && caption.textContent.includes("Contest materials")) {
                    const links = box.querySelectorAll("li a");
                    for (const link of links) {
                        if (link.textContent.toLowerCase().includes("tutorial") || link.textContent.toLowerCase().includes("editorial")) {
                            const href = link.getAttribute("href");
                            if (href) {
                                tutorialUrl = href.startsWith("http") ? href : `https://codeforces.com${href}`;
                            }
                            break;
                        }
                    }
                }
                if (tutorialUrl) break;
            }
        } catch (e) { console.warn("Tutorial extraction failed", e); }

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
            tutorialUrl,
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

export const parseEditorial = (html, problemData) => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const contentNode = doc.querySelector(".ttypography");
        if (!contentNode) {
            return "<div style='padding:20px'>Could not find editorial content (looking for .ttypography).</div>";
        }

        // Resolve params
        let problemIndex = "";
        let contestProblemId = ""; // e.g. 2169C
        let problemTitle = "";     // e.g. Range Operation

        if (typeof problemData === "string") {
            problemIndex = problemData;
        } else if (problemData) {
            problemIndex = problemData.index || "";
            if (problemData.contestId && problemData.index) {
                contestProblemId = `${problemData.contestId.toString()}${problemData.index.toString()}`;
            }
            if (problemData.title) {
                // Remove index from title if present "C. Range Operation" -> "Range Operation"
                problemTitle = problemData.title.replace(/^[A-Z0-9]{1,2}\.\s+/, "");
            }
        }

        // Clean relative links
        contentNode.querySelectorAll("img").forEach(img => {
            const src = img.getAttribute("src");
            if (src && src.startsWith("/")) {
                img.setAttribute("src", `https://codeforces.com${src}`);
            }
        });

        contentNode.querySelectorAll("a").forEach(a => {
            const href = a.getAttribute("href");
            if (href && href.startsWith("/")) {
                a.setAttribute("href", `https://codeforces.com${href}`);
            }
        });

        if (!problemIndex && !contestProblemId) return contentNode.innerHTML;

        // --- SMART EXTRACTION ---
        let extractedHtml = "";
        let foundStart = false;

        const inputIndex = problemIndex.trim();
        const baseIndex = inputIndex.replace(/\d+$/, ""); // "D2" -> "D"

        console.log(`[Editorial Parser] Index: "${inputIndex}", FullID: "${contestProblemId}", Name: "${problemTitle}"`);

        const children = Array.from(contentNode.children);
        let startNodeIndex = -1;

        const matchHeader = (text) => {
            if (!text) return false;
            const t = text.trim();

            // 1. Matches Index: "C."
            if (inputIndex && new RegExp(`^(\\d*${inputIndex}(\\.|\\s|\\)|-|—|:|$)|Problem ${inputIndex}\\b|${inputIndex}\\d+[\\/-])`, "i").test(t)) return true;

            // 2. Matches Full ID: "2169C"
            if (contestProblemId && new RegExp(`^${contestProblemId}(\\.|\\s|\\)|-|—|:|$)`, "i").test(t)) return true;

            // 3. Matches Title: "Range Operation" (partial/contains check if strong)
            if (problemTitle && t.toLowerCase().includes(problemTitle.toLowerCase())) return true;

            return false;
        };

        // Scan Children for Header Match
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const text = child.textContent.trim();
            const tag = child.tagName;
            const isHeader = /^H[1-6]$/.test(tag) || (tag === "P" && (child.querySelector("strong") || child.querySelector("b") || child.querySelector("a")));

            if (isHeader) {
                // console.log(`[Editorial Parser] Checking: "${text}"`);
                if (matchHeader(text)) {
                    console.log("  -> MATCH FOUND!");
                    startNodeIndex = i;
                    break;
                }
            }
        }

        // Fallback: Try base index if index had digits (D2 -> D)
        if (startNodeIndex === -1 && baseIndex !== inputIndex && baseIndex.length > 0) {
            const baseRgx = new RegExp(`^(\\d*${baseIndex}(\\.|\\s|\\)|-|—|:|$)|Problem ${baseIndex}\\b)`, "i");
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const text = child.textContent.trim();
                const tag = child.tagName;
                const isHeader = /^H[1-6]$/.test(tag) || (tag === "P" && (child.querySelector("strong") || child.querySelector("b") || child.querySelector("a")));

                if (isHeader && baseRgx.test(text)) {
                    // Ensure it's not matching sub-part D1 if we want D generic? 
                    // Usually D header covers D1/D2.
                    console.log("  -> MATCH FOUND (Base)!");
                    startNodeIndex = i;
                    break;
                }
            }
        }

        // --- IS NEXT PROBLEM HEADER? ---
        const isNextHeader = (text) => {
            if (!text) return false;
            // A heuristic to detect ANY problem header
            // "A.", "Problem A", "2169A", "A - Title"
            // Must NOT be "Solution", "Tutorial", "Implementation"
            if (text.toLowerCase().match(/^(solution|tutorial|implementation|hint)/)) return false;

            return /^(Problem\s+[A-Z0-9]|\d*[A-Z](?:\d+)?(\.| - | — ))/i.test(text);
        }

        if (startNodeIndex !== -1) {
            foundStart = true;
            for (let i = startNodeIndex; i < children.length; i++) {
                const child = children[i];
                const text = child.textContent.trim();
                const tag = child.tagName;
                const isHeader = /^H[1-6]$/.test(tag) || (tag === "P" && (child.querySelector("strong") || child.querySelector("b") || child.querySelector("a")));

                if (i > startNodeIndex && isHeader) {
                    if (isNextHeader(text) && !matchHeader(text)) { // Don't stop on our own sub-headers
                        console.log(`[Editorial Parser] Stopping at header: "${text}"`);
                        break;
                    }
                }
                extractedHtml += child.outerHTML;
            }
        }

        if (!foundStart || extractedHtml.length < 50) {
            // CHECK FOR DYNAMIC LOADING STATE
            if (contentNode.textContent.includes("Tutorial is loading...")) {
                return `<div style="padding:24px; text-align:center; color:#a1a1aa; background:rgba(255,255,255,0.03); border-radius:8px;">
                    <p style="margin-bottom:12px; color:#fff; font-weight:600; font-size:16px;">Editorial content is loading dynamically</p>
                    <p style="margin-bottom:16px;">This problem's editorial uses a dynamic loader that cannot be scraped simply. Please view it directly.</p>
                    <a href="${problemData.tutorialUrl || '#'}" target="_blank" style="display:inline-block; padding:10px 20px; background:#2563eb; color:white; border-radius:6px; text-decoration:none; font-weight:500;">
                        Open Editorial on Codeforces 
                    </a>
                 </div>`;
            }

            console.warn(`[Editorial] Could not extract section. Returning full.`);
            return `<div style="padding:15px; background:rgba(255,165,0,0.1); border:1px solid rgba(255,165,0,0.3); color:#fdba74; margin-bottom:20px; font-size:13px; border-radius:6px;">
                <strong>Auto-detection failed</strong><br/>
                We couldn't identify the section for this problem.<br/>
                <span style="opacity:0.7; font-size:11px">Showing full editorial below:</span>
            </div>` + contentNode.innerHTML;
        }

        // --- POST-PROCESSING ---
        // If the extracted section contains the dynamic loader text, replace it with a helpful link.
        if (extractedHtml.includes("Tutorial is loading...")) {
            const warningBox = `
                <div style="padding:12px; background:rgba(37, 99, 235, 0.1); border:1px solid rgba(37, 99, 235, 0.3); border-radius:6px; color:#93c5fd; margin:8px 0;">
                    <strong>Dynamic Content:</strong> This section requires JavaScript. 
                    <a href="${problemData.tutorialUrl || '#'}" target="_blank" style="color:#fff; text-decoration:underline; margin-left:8px;">
                        Open Original to View
                    </a>
                </div>`;

            extractedHtml = extractedHtml.replace(/Tutorial is loading\.\.\./g, warningBox);
        }

        return extractedHtml;

    } catch (e) {
        console.error("Editorial Parse Error", e);
        return `<div style='color:red; padding:20px'>Failed to parse editorial: ${e.message}</div>`;
    }
};
