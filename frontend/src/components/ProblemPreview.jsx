import React, { useState } from "react";
import { Play, Clock, Database, Tag, Copy, Check, Globe, X, BookOpen, Loader2, ExternalLink, Youtube, Search, Code } from "lucide-react";
import "katex/dist/katex.min.css";
import katex from "katex";
import { getEditorial, extractCodeBlocks } from "../utils/editorialService";
// SyntaxHighlighter removed
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// --- MATH RENDERER ---
const renderMath = (html, options = {}) => {
    if (!html) return "";
    const { skipDollarMath = false } = options;
    
    // Helper to clean LaTeX source (strip HTML tags, decode entities)
    const cleanTex = (tex) => {
        let cleaned = tex
            // Strip HTML tags
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<[^>]*>/g, "")
            // Decode HTML entities
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
            .replace(/&nbsp;/g, " ")
            .replace(/&le;/g, "\\leq ")
            .replace(/&ge;/g, "\\geq ")
            .replace(/&times;/g, "\\times ")
            .replace(/&middot;/g, "\\cdot ")
            .replace(/&minus;/g, "-")
            .replace(/&plusmn;/g, "\\pm ")
            .replace(/&#(\d+);/g, (m, code) => String.fromCharCode(parseInt(code)))
            .replace(/&#x([0-9A-Fa-f]+);/g, (m, code) => String.fromCharCode(parseInt(code, 16)))
            // Fix common LaTeX issues
            .replace(/\\le(?!q)\s*/g, "\\leq ")
            .replace(/\\ge(?!q)\s*/g, "\\geq ")
            .replace(/\\cdots/g, "\\cdots ")
            .replace(/\\ldots/g, "\\ldots ")
            // Handle subscripts/superscripts without braces
            .replace(/_([a-zA-Z0-9])\s/g, "_{$1} ")
            .replace(/\^([a-zA-Z0-9])\s/g, "^{$1} ")
            .trim();
        return cleaned;
    };

    // Safe KaTeX render wrapper
    const safeRender = (tex, displayMode = false) => {
        try {
            const cleaned = cleanTex(tex);
            if (!cleaned) return "";
            return katex.renderToString(cleaned, { 
                throwOnError: false, 
                displayMode,
                strict: false,
                trust: true,
                macros: {
                    "\\le": "\\leq",
                    "\\ge": "\\geq",
                    "\\xor": "\\oplus",
                    "\\and": "\\land",
                    "\\or": "\\lor",
                    "\\mod": "\\bmod",
                    "\\N": "\\mathbb{N}",
                    "\\Z": "\\mathbb{Z}",
                    "\\R": "\\mathbb{R}",
                    "\\C": "\\mathbb{C}"
                }
            });
        } catch (e) { 
            console.warn("KaTeX error:", e.message, tex);
            // Return styled fallback instead of raw LaTeX
            return `<span style="color:#fbbf24;font-family:monospace;font-size:0.9em;background:rgba(251,191,36,0.1);padding:1px 4px;border-radius:3px;">${tex.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
        }
    };

    let result = html;
    
    // 0. Pre-process: Handle Codeforces <span class="tex-font-style-it">x</span> (italics containing math variables)
    result = result.replace(/<span\s+class="tex-font-style-it">([^<]+)<\/span>/gi, (match, content) => {
        const trimmed = content.trim();
        // Render as math if it looks like a variable (single letter, short text, or has math symbols)
        if (trimmed.length <= 5 && /^[a-zA-Z0-9_\s]+$/.test(trimmed)) {
            return safeRender(trimmed, false);
        }
        // Check for math-like content
        if (/[\\^_{}]/.test(trimmed) || /^\d+$/.test(trimmed)) {
            return safeRender(trimmed, false);
        }
        return `<em>${content}</em>`;
    });
    
    // 1. Handle Codeforces $$$ ... $$$  (MUST come before single $)
    if (!skipDollarMath) {
        result = result.replace(/\$\$\$([\s\S]*?)\$\$\$/g, (match, tex) => safeRender(tex, false));
    }
    
    // 2. Handle Legacy Codeforces <span class="tex-span">...</span>
    result = result.replace(/<span class="tex-span">([\s\S]*?)<\/span>/g, (match, tex) => safeRender(tex, false));
    
    // 3. Handle display math \[ ... \]
    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (match, tex) => safeRender(tex, true));
    
    // 4. Handle inline math \( ... \)
    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (match, tex) => safeRender(tex, false));
    
    // 5. Handle \begin{...} ... \end{...} blocks
    result = result.replace(/(\\begin\{([a-zA-Z0-9*]+)\}[\s\S]*?\\end\{\2\})/g, (match, tex) => safeRender(tex, true));
    
    if (!skipDollarMath) {
        // 6. Handle display math $$ ... $$ (double dollar - MUST come before single)
        result = result.replace(/\$\$([^\$]+?)\$\$/g, (match, tex) => safeRender(tex, true));
        
        // 7. Handle inline math $ ... $ (single dollar - must be careful not to match already processed $$)
        result = result.replace(/(?<!\$)\$([^\$\n]+?)\$(?!\$)/g, (match, tex) => {
            return safeRender(tex, false);
        });
    }
    
    // 8. Handle Codeforces <span class="tex-font-style-bf">...</span> (bold)
    result = result.replace(/<span\s+class="tex-font-style-bf">([^<]+)<\/span>/gi, (match, content) => {
        return `<strong>${content}</strong>`;
    });
    
    // 9. Handle Codeforces <span class="tex-font-style-tt">...</span> (monospace/code)
    result = result.replace(/<span\s+class="tex-font-style-tt">([^<]+)<\/span>/gi, (match, content) => {
        return `<code style="background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:3px;font-family:monospace;">${content}</code>`;
    });

    return result;
};

// Normalize MathJax HTML into inline LaTeX/text so variables don't disappear
const normalizeMathJaxHtml = (html) => {
    if (!html) return "";

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const root = doc.body || doc;

        // Convert MathJax script tags to inline LaTeX
        root.querySelectorAll('script[type*="math/tex"]').forEach(script => {
            const tex = script.textContent || "";
            const type = (script.getAttribute("type") || "").toLowerCase();
            if (!tex.trim()) {
                script.remove();
                return;
            }
            const latex = type.includes("mode=display") ? `$$${tex}$$` : `$${tex}$`;
            script.replaceWith(doc.createTextNode(latex));
        });

        // Remove preview-only nodes
        root.querySelectorAll('.MathJax_Preview, .MJX_Assistive_MathML').forEach(node => node.remove());

        // Replace rendered MathJax spans with their text content
        root.querySelectorAll('.MathJax, .MathJax_SVG, .MathJax_CHTML, [class^="mjx-"], [class*=" mjx-"]')
            .forEach(node => {
                const text = node.textContent || "";
                if (text.trim()) {
                    node.replaceWith(doc.createTextNode(text));
                } else {
                    node.remove();
                }
            });

        return root.innerHTML || "";
    } catch (e) {
        console.warn("MathJax normalize failed:", e.message);
        return html;
    }
};

// Wrap bare LaTeX commands outside $...$ so they render with KaTeX
const wrapBareLatexOutsideMath = (html) => {
    if (!html) return html;
    const parts = html.split("$");
    const wrapped = parts.map((part, idx) => {
        if (idx % 2 !== 0) return part; // inside math
        return part.replace(/\\[a-zA-Z]+[^$<\n.;:]*/g, (m) => {
            const trimmed = m.trim();
            return trimmed ? `$${trimmed}$` : m;
        });
    });
    return wrapped.join("$");
};


/* ... */



const CopyButton = ({ text }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
         navigator.clipboard.writeText(text);
         setCopied(true);
         setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button 
            onClick={handleCopy}
            style={{ 
                background: copied ? "rgba(34, 197, 94, 0.2)" : "rgba(255,255,255,0.05)", 
                border: "1px solid",
                borderColor: copied ? "rgba(34, 197, 94, 0.4)" : "rgba(255,255,255,0.1)",
                color: copied ? "#4ade80" : "#a1a1aa", 
                padding: "4px 8px", borderRadius: "6px", fontSize: "10px", 
                cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                transition: "all 0.2s"
            }}
        >
            {copied ? <Check size={10}/> : <Copy size={10}/>}
            {copied ? "Copied" : "Copy"}
        </button>
    );
};

export default function ProblemPreview({ problem, onCodeNow }) {
    if (!problem) return <div style={{ padding: "24px", color: "#666" }}>Select a problem to view details.</div>;

    // --- EDITORIAL STATE ---
    const [showEditorial, setShowEditorial] = useState(false);
    const [editorial, setEditorial] = useState(null);
    const [loadingEditorial, setLoadingEditorial] = useState(false);
    const [editorialTab, setEditorialTab] = useState('tutorial'); // 'tutorial' or 'code'
    const [codeBlocks, setCodeBlocks] = useState([]);
    const [copiedCodeIndex, setCopiedCodeIndex] = useState(-1);

    const handleOpenEditorial = async () => {
        setShowEditorial(true);
        if (editorial) return; // Already loaded

        setLoadingEditorial(true);
        try {
            // Fetch official Codeforces tutorial via backend API
            console.log('[ProblemPreview] Calling getEditorial with:', { contestId: problem.contestId, index: problem.index });
            const result = await getEditorial(problem.contestId, problem.index);
            setEditorial(result);
            
            // Extract code blocks if successful
            if (result.success && result.content) {
                const codes = extractCodeBlocks(result.problemSection || result.content);
                setCodeBlocks(codes);
            }
        } catch (e) {
            console.error("Editorial Load Failed", e);
            setEditorial({
                success: false,
                error: e.message || "Failed to load editorial"
            });
        } finally {
            setLoadingEditorial(false);
        }
    };

    const copyCode = (code, index) => {
        navigator.clipboard.writeText(code);
        setCopiedCodeIndex(index);
        setTimeout(() => setCopiedCodeIndex(-1), 2000);
    };

    // Process HTML content for display - transforms Codeforces spoiler structure
    const processEditorialContent = (html) => {
        if (!html) return '';
        
        let processed = renderMath(html);
        
        // Codeforces uses: <div class="spoiler"><b class="spoiler-title">Title</b><div class="spoiler-content" style="display: none;">...</div></div>
        // We need to transform this to work with our CSS that uses .spoiler.open to toggle visibility
        
        // Step 1: Convert <b class="spoiler-title"> to <div class="spoiler-title">
        processed = processed.replace(/<b\s+class="spoiler-title">/gi, '<div class="spoiler-title">');
        processed = processed.replace(/<\/b>(\s*)<div class="spoiler-content"/gi, '</div>$1<div class="spoiler-content"');
        
        // Step 2: Remove the inline "display: none" style from spoiler-content (our CSS handles this)
        processed = processed.replace(/<div class="spoiler-content"\s*style="[^"]*display:\s*none[^"]*">/gi, '<div class="spoiler-content">');
        processed = processed.replace(/<div class="spoiler-content"\s*style="display:\s*none;">/gi, '<div class="spoiler-content">');
        
        // Step 3: Handle the arrow format some blogs use
        processed = processed.replace(/►\s*<span[^>]*>([^<]*)<\/span>/gi, '<div class="spoiler"><div class="spoiler-title">$1</div><div class="spoiler-content">');
        
        // Step 4: Make CF problem links styled nicely
        processed = processed.replace(/<a[^>]*href="([^"]*\/problem\/[^"]*)"[^>]*>([^<]*)<\/a>/gi, 
            '<a href="https://codeforces.com$1" target="_blank" style="color:#60a5fa;font-weight:600;text-decoration:none;">$2</a>');
        
        // Step 5: Make CF blog links point to codeforces.com
        processed = processed.replace(/<a[^>]*href="\/([^"]*)"[^>]*>/gi, '<a href="https://codeforces.com/$1" target="_blank">');
        
        return processed;
    };

    const isLeetCode = problem.provider === "leetcode";
    const mathOptions = { skipDollarMath: isLeetCode };
    const processedDescription = React.useMemo(
        () => isLeetCode 
            ? renderMath(problem.description, mathOptions)
            : renderMath(wrapBareLatexOutsideMath(normalizeMathJaxHtml(problem.description))),
        [problem.description, problem.provider]
    );
    const processedNote = React.useMemo(
        () => isLeetCode
            ? renderMath(problem.note, mathOptions)
            : renderMath(wrapBareLatexOutsideMath(normalizeMathJaxHtml(problem.note))),
        [problem.note, problem.provider]
    );

    if (!processedDescription && !processedNote && !problem.isSolved) {
        return (
            <div style={{ padding: "40px", textAlign: "center", color: "#a1a1aa" }}>
                <h3>Description Unavailable</h3>
                <p>The problem description looks empty. It might not have synced correctly.</p>
                <div style={{ marginTop: "16px" }}>
                    <a href={problem.url} target="_blank" style={{ color: "#60a5fa" }}>View on {problem.provider === 'codeforces' ? 'Codeforces' : 'Original Site'}</a>
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#09090b", color: "#e4e4e7", fontFamily: "verdana, arial, sans-serif" }}>
            
            {/* CONTENT SCROLL AREA */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                
                {/* 1. HEADER (Gradient Overlay) */}
                <div style={{ 
                    padding: "32px 40px", 
                    background: "linear-gradient(180deg, rgba(30, 27, 75, 0.3) 0%, transparent 100%)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    position: "relative" // For absolute badge positioning
                }}>
                    {problem.isSolved && (
                        <div style={{
                            position: "absolute", top: "32px", right: "40px",
                            display: "flex", alignItems: "center", gap: "6px",
                            background: "rgba(34, 197, 94, 0.1)", color: "#4ade80",
                            padding: "6px 12px", borderRadius: "20px",
                            fontSize: "12px", fontWeight: "600", border: "1px solid rgba(34, 197, 94, 0.2)"
                        }}>
                            <Check size={14} strokeWidth={3} /> Solved
                        </div>
                    )}
                    {problem.isAttempted && (
                        <div style={{
                            position: "absolute", top: "32px", right: "40px",
                            display: "flex", alignItems: "center", gap: "6px",
                            background: "rgba(239, 68, 68, 0.1)", color: "#ef4444",
                            padding: "6px 12px", borderRadius: "20px",
                            fontSize: "12px", fontWeight: "600", border: "1px solid rgba(239, 68, 68, 0.2)"
                        }}>
                            <X size={14} strokeWidth={3} /> Attempted
                        </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", opacity: 0.8 }}>
                         {/* Provider Badge */}
                         {problem.provider && (
                             <span style={{ 
                                 fontSize: "10px", fontWeight: "700", textTransform: "uppercase",
                                 padding: "4px 8px", borderRadius: "6px",
                                 background: problem.provider === "leetcode" ? "rgba(251, 191, 36, 0.15)" :
                                            problem.provider === "geeksforgeeks" ? "rgba(34, 197, 94, 0.15)" :
                                            problem.provider === "codingninjas" ? "rgba(249, 115, 22, 0.15)" :
                                            "rgba(59, 130, 246, 0.15)",
                                 color: problem.provider === "leetcode" ? "#fbbf24" :
                                       problem.provider === "geeksforgeeks" ? "#22c55e" :
                                       problem.provider === "codingninjas" ? "#f97316" :
                                       "#3b82f6",
                                 border: `1px solid ${problem.provider === "leetcode" ? "rgba(251, 191, 36, 0.3)" :
                                                     problem.provider === "geeksforgeeks" ? "rgba(34, 197, 94, 0.3)" :
                                                     problem.provider === "codingninjas" ? "rgba(249, 115, 22, 0.3)" :
                                                     "rgba(59, 130, 246, 0.3)"}`
                             }}>
                                 {problem.provider === "geeksforgeeks" ? "GFG" : 
                                  problem.provider === "codingninjas" ? "CodingNinjas" :
                                  problem.provider === "leetcode" ? "LeetCode" :
                                  problem.provider === "codeforces" ? "CF" : problem.provider}
                             </span>
                         )}
                         {/* Problem ID */}
                         {(problem.contestId || problem.questionFrontendId || problem.titleSlug) && (
                             <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "#a1a1aa", padding: "4px 8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                 {problem.contestId ? `${problem.contestId}${problem.index}` : 
                                  problem.questionFrontendId ? `#${problem.questionFrontendId}` :
                                  problem.titleSlug || problem.id}
                             </span>
                         )}
                         {/* Rating (CF) or Difficulty (LC/GFG) */}
                         {problem.rating && (
                             <span style={{ fontSize: "12px", fontWeight: "bold", color: problem.rating >= 2000 ? "#ef4444" : (problem.rating >= 1400 ? "#3b82f6" : "#22c55e") }}>
                                 {problem.rating}
                             </span>
                         )}
                         {problem.difficulty && !problem.rating && (
                             <span style={{ 
                                 fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "12px",
                                 background: problem.difficulty === "Easy" ? "rgba(34, 197, 94, 0.15)" :
                                            problem.difficulty === "Medium" ? "rgba(245, 158, 11, 0.15)" :
                                            "rgba(239, 68, 68, 0.15)",
                                 color: problem.difficulty === "Easy" ? "#22c55e" :
                                       problem.difficulty === "Medium" ? "#f59e0b" : "#ef4444"
                             }}>
                                 {problem.difficulty}
                             </span>
                         )}
                    </div>
                    
                    <h1 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "20px", color: "white", letterSpacing: "-0.5px" }}>
                        {problem.title}
                    </h1>
                    
                    <div style={{ display: "flex", gap: "24px", fontSize: "13px", color: "#a1a1aa" }}>
                        {problem.timeLimit && <div style={{ display:"flex", alignItems:"center", gap:"6px" }}><Clock size={14}/> {problem.timeLimit}</div>}
                        {problem.memoryLimit && <div style={{ display:"flex", alignItems:"center", gap:"6px" }}><Database size={14}/> {problem.memoryLimit}</div>}
                        {problem.tags && problem.tags.length > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Tag size={14}/>
                                {problem.tags.slice(0,3).join(", ")}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. DESCRIPTION BODY */}
                <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
                    <style>
                        {`
                        .problem-content { 
                            width: 100%; 
                            overflow-x: hidden; 
                            word-wrap: break-word; 
                            overflow-wrap: break-word;
                        }
                        .problem-content * {
                            max-width: 100%;
                            box-sizing: border-box;
                        }
                        .problem-content p, .problem-content div, .problem-content li {
                            white-space: normal !important;
                            word-break: break-word;
                        }
                        .problem-content pre { 
                            white-space: pre-wrap !important; 
                            word-wrap: break-word; 
                            overflow-x: auto;
                            background: rgba(255,255,255,0.05); 
                            padding: 10px; 
                            border-radius: 6px; 
                        }
                        .problem-content img { max-width: 100%; height: auto; }
                        .problem-content .header, .problem-content .sample-tests, .problem-content .title { display: none !important; }
                        `}
                    </style>
                    <div 
                        className="problem-content"
                        style={{ lineHeight: "1.7", fontSize: "15px", color: "#d4d4d8" }}
                        dangerouslySetInnerHTML={{ __html: processedDescription || "<p style='opacity:0.5'>No description content.</p>" }}
                    />

                    {/* 3. TEST CASES (Stacked Layout - Codeforces Style) */}
                    {problem.testCases && Array.isArray(problem.testCases) && problem.testCases.length > 0 && (
                         <div style={{ marginTop: "48px" }}>
                             <h3 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "20px", color: "#fff", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.7 }}>Test Cases</h3>
                             
                             <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                 {problem.testCases.map((tc, idx) => (
                                     <div key={idx} style={{ 
                                         display: "grid", gridTemplateColumns: "1fr 1fr", 
                                         border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", overflow: "hidden",
                                         background: "#18181b" 
                                     }}>
                                         {/* INPUT COLUMN */}
                                         <div style={{ borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column" }}>
                                             <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                 <span style={{ fontSize: "11px", fontWeight: "700", color: "#a1a1aa", letterSpacing: "0.5px" }}>INPUT</span>
                                                 <CopyButton text={tc.input} />
                                             </div>
                                             <pre style={{ margin: 0, padding: "12px", flex: 1, fontFamily: "Consolas, Monaco, 'Andale Mono', monospace", fontSize: "13px", color: "#e4e4e7", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: "1.5" }}>{tc.input}</pre>
                                         </div>

                                         {/* OUTPUT COLUMN */}
                                         <div style={{ display: "flex", flexDirection: "column" }}>
                                             <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                 <span style={{ fontSize: "11px", fontWeight: "700", color: "#a1a1aa", letterSpacing: "0.5px" }}>OUTPUT</span>
                                                 <CopyButton text={tc.expectedOutput} />
                                             </div>
                                             <pre style={{ margin: 0, padding: "12px", flex: 1, fontFamily: "Consolas, Monaco, 'Andale Mono', monospace", fontSize: "13px", color: "#e4e4e7", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: "1.5" }}>{tc.expectedOutput}</pre>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                    )}

                    {/* 4. NOTE */}
                    {processedNote && (
                        <div style={{ marginTop: "40px", padding: "20px", background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.1)", borderRadius: "8px" }}>
                            <h4 style={{ fontSize: "12px", fontWeight:"700", color: "#60a5fa", marginBottom: "8px", textTransform: "uppercase" }}>Note</h4>
                            <div 
                                style={{ lineHeight: "1.6", fontSize: "14px", color: "#e4e4e7" }} 
                                dangerouslySetInnerHTML={{ __html: processedNote }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ACTION BAR */}
            <div style={{ 
                padding: "16px 40px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "#09090b",
                display: "flex", justifyContent: "flex-end", gap: "12px"
            }}>
                {/* Open on Platform Button */}
                {problem.url && (
                    <a 
                        href={problem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ 
                            padding: "12px 20px", fontSize: "14px", fontWeight: "600", 
                            background: "rgba(255,255,255,0.05)", 
                            color: "#a1a1aa", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex", alignItems: "center", gap: "8px",
                            cursor: "pointer", transition: "all 0.2s", textDecoration: "none"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color="white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color="#a1a1aa"; }}
                    >
                        <ExternalLink size={16} /> Open on {
                            problem.provider === "leetcode" ? "LeetCode" :
                            problem.provider === "geeksforgeeks" ? "GFG" :
                            problem.provider === "codingninjas" ? "CodingNinjas" :
                            problem.provider === "codeforces" ? "CF" : "Platform"
                        }
                    </a>
                )}
                {/* Editorial Button - Only for Codeforces */}
                {(!problem.provider || problem.provider === "codeforces") && (
                    <button 
                        onClick={handleOpenEditorial}
                        title="View official Codeforces tutorial"
                        style={{ 
                            padding: "12px 20px", fontSize: "14px", fontWeight: "600", 
                            background: "rgba(255,255,255,0.05)", 
                            color: "#a1a1aa", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
                            display: "flex", alignItems: "center", gap: "8px",
                            cursor: "pointer", transition: "all 0.2s"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color="white"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color="#a1a1aa"; }}
                    >
                        <BookOpen size={16} /> Tutorial
                    </button>
                )}
                <button 
                    onClick={() => onCodeNow(problem)}
                    style={{ 
                        padding: "12px 28px", fontSize: "14px", fontWeight: "600", 
                        background: "linear-gradient(135deg, #3b82f6, #2563eb)", 
                        color: "white", borderRadius: "8px", border: "none",
                        display: "flex", alignItems: "center", gap: "8px",
                        cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.2)"
                    }}
                >
                    <Play size={16} fill="white" /> Code Now
                </button>
            </div>
            
             {/* Global Styles for Math/HTML Content */}
            <style>{`
                .problem-content p { margin-bottom: 1em; opacity: 0.9; }
                .problem-content ul, .problem-content ol { margin: 1em 0 1em 1.5em; opacity: 0.9; }
                .problem-content li { margin-bottom: 0.5em; }
                .problem-content strong { color: white; font-weight: 600; }
                .problem-content pre { background: rgba(255,255,255,0.05); padding: 8px; borderRadius: 4px; overflow-x: auto; }
            `}</style>

            {/* EDITORIAL MODAL */}
            {showEditorial && (
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
                    zIndex: 50, display: "flex", justifyContent: "center", alignItems: "center"
                }}>
                    <div style={{
                        width: "90%", maxWidth: "850px", height: "85%",
                        background: "#09090b", border: "1px solid #27272a", borderRadius: "12px",
                        display: "flex", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
                    }}>
                        {/* Header */}
                        <div style={{ padding: "16px 24px", borderBottom: "1px solid #27272a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fff", margin: 0 }}>
                                    Tutorial: {problem.contestId}{problem.index}
                                </h2>
                                {editorial?.author && (
                                    <span style={{ fontSize: "12px", color: "#71717a" }}>
                                        by <a href={`https://codeforces.com/profile/${editorial.author}`} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa" }}>{editorial.author}</a>
                                    </span>
                                )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                {editorial?.url && (
                                    <a
                                        href={editorial.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: "flex", alignItems: "center", gap: "6px",
                                            padding: "8px 14px", backgroundColor: "#3b82f6", color: "#fff",
                                            textDecoration: "none", borderRadius: "6px", fontSize: "13px"
                                        }}
                                    >
                                        <ExternalLink size={14} /> Open on CF
                                    </a>
                                )}
                                <button onClick={() => setShowEditorial(false)} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer" }}><X size={20}/></button>
                            </div>
                        </div>
                        
                        {/* Tabs */}
                        {editorial?.success && (
                            <div style={{ display: "flex", borderBottom: "1px solid #27272a", backgroundColor: "#0a0a0a" }}>
                                <button
                                    onClick={() => setEditorialTab('tutorial')}
                                    style={{
                                        padding: "12px 24px", background: editorialTab === 'tutorial' ? '#09090b' : 'transparent',
                                        border: "none", borderBottom: editorialTab === 'tutorial' ? '2px solid #3b82f6' : '2px solid transparent',
                                        color: editorialTab === 'tutorial' ? '#fff' : '#71717a', cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: "8px"
                                    }}
                                >
                                    <BookOpen size={16} /> Tutorial
                                </button>
                                <button
                                    onClick={() => setEditorialTab('code')}
                                    style={{
                                        padding: "12px 24px", background: editorialTab === 'code' ? '#09090b' : 'transparent',
                                        border: "none", borderBottom: editorialTab === 'code' ? '2px solid #3b82f6' : '2px solid transparent',
                                        color: editorialTab === 'code' ? '#fff' : '#71717a', cursor: "pointer",
                                        display: "flex", alignItems: "center", gap: "8px"
                                    }}
                                >
                                    <Code size={16} /> Code ({codeBlocks.length})
                                </button>
                            </div>
                        )}
                        
                        {/* Content */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                            {/* Spoiler Styles for Codeforces dropdowns */}
                            <style>{`
                                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                                
                                /* Codeforces Spoiler Styles - exact match */
                                .editorial-content .spoiler {
                                    margin: 16px 0;
                                    border: 1px solid #3f3f46;
                                    border-radius: 8px;
                                    overflow: hidden;
                                    background: #18181b;
                                }
                                .editorial-content .spoiler-title {
                                    display: flex;
                                    align-items: center;
                                    gap: 10px;
                                    padding: 14px 18px;
                                    background: linear-gradient(135deg, #1f1f23 0%, #27272a 100%);
                                    cursor: pointer;
                                    font-weight: 700;
                                    font-size: 14px;
                                    color: #60a5fa;
                                    user-select: none;
                                    transition: all 0.2s;
                                    border: none;
                                }
                                .editorial-content .spoiler-title:hover {
                                    background: linear-gradient(135deg, #27272a 0%, #3f3f46 100%);
                                    color: #93c5fd;
                                }
                                .editorial-content .spoiler-title::before {
                                    content: "▶";
                                    font-size: 11px;
                                    transition: transform 0.3s ease;
                                    color: #71717a;
                                    flex-shrink: 0;
                                }
                                .editorial-content .spoiler.open .spoiler-title {
                                    background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%);
                                    color: #93c5fd;
                                }
                                .editorial-content .spoiler.open .spoiler-title::before {
                                    transform: rotate(90deg);
                                    color: #60a5fa;
                                }
                                .editorial-content .spoiler-content {
                                    display: none;
                                    padding: 20px;
                                    border-top: 1px solid #3f3f46;
                                    background: #0f0f11;
                                    line-height: 1.8;
                                }
                                .editorial-content .spoiler.open .spoiler-content {
                                    display: block !important;
                                    animation: slideDown 0.25s ease-out;
                                }
                                @keyframes slideDown {
                                    from { opacity: 0; transform: translateY(-10px); }
                                    to { opacity: 1; transform: translateY(0); }
                                }
                                
                                /* Code blocks inside editorial */
                                .editorial-content pre {
                                    background: #0a0a0a !important;
                                    border: 1px solid #27272a;
                                    border-radius: 6px;
                                    padding: 16px !important;
                                    overflow-x: auto;
                                    font-family: 'JetBrains Mono', Consolas, monospace;
                                    font-size: 13px;
                                    line-height: 1.5;
                                    margin: 12px 0;
                                }
                                .editorial-content code {
                                    background: #27272a;
                                    padding: 2px 6px;
                                    border-radius: 4px;
                                    font-family: 'JetBrains Mono', Consolas, monospace;
                                    font-size: 0.9em;
                                }
                                .editorial-content pre code {
                                    background: transparent;
                                    padding: 0;
                                }
                                
                                /* Links */
                                .editorial-content a {
                                    color: #60a5fa;
                                    text-decoration: none;
                                }
                                .editorial-content a:hover {
                                    text-decoration: underline;
                                }
                                
                                /* Problem sections */
                                .editorial-content h1, .editorial-content h2, .editorial-content h3 {
                                    color: #fff;
                                    margin-top: 24px;
                                    margin-bottom: 12px;
                                }
                                .editorial-content p {
                                    margin-bottom: 12px;
                                }
                                .editorial-content ul, .editorial-content ol {
                                    padding-left: 24px;
                                    margin-bottom: 12px;
                                }
                                .editorial-content li {
                                    margin-bottom: 6px;
                                }
                                .editorial-content img {
                                    max-width: 100%;
                                    border-radius: 8px;
                                    margin: 12px 0;
                                }
                                .editorial-content table {
                                    border-collapse: collapse;
                                    width: 100%;
                                    margin: 12px 0;
                                }
                                .editorial-content th, .editorial-content td {
                                    border: 1px solid #27272a;
                                    padding: 8px 12px;
                                    text-align: left;
                                }
                                .editorial-content th {
                                    background: #1f1f23;
                                }
                                
                                /* MathJax fix */
                                .editorial-content .MathJax {
                                    font-size: 100% !important;
                                }
                            `}</style>
                            
                            {loadingEditorial ? (
                                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#a1a1aa", gap: "12px" }}>
                                    <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
                                    <span>Fetching tutorial from Codeforces...</span>
                                </div>
                            ) : editorial?.success ? (
                                editorialTab === 'tutorial' ? (
                                    /* Tutorial Tab */
                                    <div 
                                        className="editorial-content problem-content"
                                        style={{ lineHeight: "1.7", fontSize: "15px", color: "#d4d4d8" }}
                                        dangerouslySetInnerHTML={{ 
                                            __html: processEditorialContent(editorial.content) || "No content available." 
                                        }}
                                        onClick={(e) => {
                                            // Handle spoiler toggle clicks
                                            const spoilerTitle = e.target.closest('.spoiler-title');
                                            if (spoilerTitle) {
                                                const spoiler = spoilerTitle.closest('.spoiler');
                                                if (spoiler) {
                                                    spoiler.classList.toggle('open');
                                                }
                                                e.preventDefault();
                                                return;
                                            }
                                            
                                            // Handle links - open in new tab
                                            const link = e.target.closest('a');
                                            if (link && link.href) {
                                                link.target = '_blank';
                                            }
                                        }}
                                    />
                                ) : (
                                    /* Code Tab */
                                    codeBlocks.length > 0 ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                            {codeBlocks.map((block, idx) => (
                                                <div key={idx} style={{ backgroundColor: "#18181b", borderRadius: "8px", border: "1px solid #27272a", overflow: "hidden" }}>
                                                    <div style={{ padding: "10px 16px", backgroundColor: "#0a0a0a", borderBottom: "1px solid #27272a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                        <span style={{ color: "#71717a", fontSize: "12px" }}>Solution {idx + 1} ({block.language.toUpperCase()})</span>
                                                        <button
                                                            onClick={() => copyCode(block.code, idx)}
                                                            style={{
                                                                padding: "6px 12px", backgroundColor: "#27272a", border: "none",
                                                                borderRadius: "4px", color: "#d4d4d8", cursor: "pointer",
                                                                display: "flex", alignItems: "center", gap: "6px", fontSize: "12px"
                                                            }}
                                                        >
                                                            {copiedCodeIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                                                            {copiedCodeIndex === idx ? 'Copied!' : 'Copy'}
                                                        </button>
                                                    </div>
                                                    <pre style={{ margin: 0, padding: "16px", fontSize: "13px", lineHeight: "1.5", maxHeight: "400px", background: "#0a0a0a", color: "#d4d4d8", overflowX: "auto", fontFamily: "Consolas, monospace" }}>
                                                        <code>{block.code}</code>
                                                    </pre>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: "center", padding: "60px 20px", color: "#71717a" }}>
                                            <Code size={48} style={{ marginBottom: "15px", opacity: 0.5 }} />
                                            <p style={{ margin: "0 0 10px 0" }}>No code blocks found in this tutorial.</p>
                                            <p style={{ fontSize: "13px" }}>Check the Tutorial tab for the solution approach.</p>
                                        </div>
                                    )
                                )
                            ) : (
                                /* Not Found State */
                                <div style={{ textAlign: "center", padding: "40px" }}>
                                    <div style={{ fontSize: "64px", marginBottom: "20px" }}>📝</div>
                                    <h3 style={{ color: "#fff", marginBottom: "10px" }}>Tutorial Not Available</h3>
                                    <p style={{ color: "#71717a", marginBottom: "25px", maxWidth: "400px", margin: "0 auto 25px" }}>
                                        {editorial?.error || "The official tutorial for this contest hasn't been found or may not be published yet."}
                                    </p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
                                        <a
                                            href={`https://codeforces.com/search?query=${problem.contestId}+tutorial`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: "inline-flex", alignItems: "center", gap: "8px",
                                                padding: "12px 24px", backgroundColor: "#3b82f6", color: "#fff",
                                                textDecoration: "none", borderRadius: "6px", fontWeight: "500"
                                            }}
                                        >
                                            <Search size={16} /> Search on Codeforces
                                        </a>
                                        <a
                                            href={`https://www.youtube.com/results?search_query=codeforces+${problem.contestId}+${problem.index}+tutorial`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: "inline-flex", alignItems: "center", gap: "8px",
                                                padding: "12px 24px", backgroundColor: "#c4302b", color: "#fff",
                                                textDecoration: "none", borderRadius: "6px", fontWeight: "500"
                                            }}
                                        >
                                            <Youtube size={16} /> YouTube Tutorials
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
