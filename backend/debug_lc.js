
async function debugLeetCode() {
    const slug = "two-sum";
    const query = `
        query getQuestionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                questionId
                questionFrontendId
                title
                content
                difficulty
                exampleTestcases
                codeSnippets {
                    lang
                    langSlug
                    code
                }
            }
        }
    `;

    const response = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Referer": "https://leetcode.com"
        },
        body: JSON.stringify({
            query,
            variables: { titleSlug: slug }
        })
    });

    const data = await response.json();
    const question = data.data?.question;

    console.log("--- Snippets ---");
    const cppSnippet = question.codeSnippets.find(s => s.langSlug === "cpp");
    console.log(cppSnippet?.code);

    console.log("\n--- Examples (Raw) ---");
    console.log(question.exampleTestcases);

    // Simulate my parsing logic
    console.log("\n--- Parsed Logic Check ---");

    // Logic from Workspace.jsx
    const lines = question.exampleTestcases.trim().split('\n');
    console.log("Split Lines:", lines);

    const openParen = cppSnippet.code.indexOf("(");
    const closeParen = cppSnippet.code.indexOf(")", openParen);
    let argCount = 1;

    if (openParen !== -1 && closeParen !== -1) {
        const argsStr = cppSnippet.code.substring(openParen + 1, closeParen);
        console.log("Args Str:", argsStr);
        if (!argsStr.trim()) argCount = 0;
        else {
            let depth = 0;
            argCount = 1; // Start with 1 if not empty
            for (let char of argsStr) {
                if (char === "<") depth++;
                else if (char === ">") depth--;
                else if (char === "," && depth === 0) argCount++;
            }
        }
    }
    console.log("Arg Count:", argCount);

    const inputs = [];
    if (argCount > 0) {
        for (let i = 0; i < lines.length; i += argCount) {
            const inputChunk = lines.slice(i, i + argCount).join("\n");
            if (inputChunk) inputs.push(inputChunk);
        }
    }
    console.log("Resulting Inputs:", inputs);

}

debugLeetCode();
