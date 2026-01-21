import React, { useState, useRef, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const HighlightedTextarea = ({ value, onChange, language = "text", placeholder, style }) => {
    const textareaRef = useRef(null);
    const preRef = useRef(null);

    const handleScroll = () => {
        if (textareaRef.current && preRef.current) {
            // Use requestAnimationFrame for smooth sync
            requestAnimationFrame(() => {
                if (textareaRef.current && preRef.current) {
                    preRef.current.scrollTop = textareaRef.current.scrollTop;
                    preRef.current.scrollLeft = textareaRef.current.scrollLeft;
                }
            });
        }
    };

    return (
        <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "60px", ...style }}>
            {/* Syntax Highlighter (Background) */}
            <div 
                ref={preRef}
                style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    margin: 0, padding: "10px", 
                    overflow: "hidden", // Hidden scrollbars, controlled by textarea
                    borderRadius: "4px",
                    background: "#0a0a0a", // Match textarea bg
                    pointerEvents: "none", // Let clicks pass through to textarea
                    fontSize: "12px", fontFamily: "'Fira Code', monospace", lineHeight: "1.5",
                    zIndex: 0
                }}
            >
                <SyntaxHighlighter
                    language={language}
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, padding: 0, background: "transparent", fontSize: "12px", lineHeight: "1.5" }}
                    codeTagProps={{ style: { fontFamily: "'Fira Code', monospace" } }}
                >
                    {value || " "} 
                </SyntaxHighlighter>
            </div>

            {/* Transparent Textarea (Foreground) */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={onChange}
                onScroll={handleScroll}
                placeholder={placeholder}
                spellCheck={false}
                style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    margin: 0, padding: "10px",
                    width: "100%", height: "100%",
                    overflow: "auto",
                    background: "transparent",
                    color: "transparent", // Hide text
                    caretColor: "#fff", // Show cursor
                    border: "1px solid #333", borderRadius: "4px",
                    fontSize: "12px", fontFamily: "'Fira Code', monospace", lineHeight: "1.5",
                    resize: "none", outline: "none",
                    zIndex: 1,
                    boxSizing: "border-box"
                }}
                onFocus={(e) => e.target.style.borderColor = "#555"}
                onBlur={(e) => e.target.style.borderColor = "#333"}
            />
        </div>
    );
};

export default HighlightedTextarea;
