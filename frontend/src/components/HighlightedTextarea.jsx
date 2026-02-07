import React, { useRef } from 'react';

const HighlightedTextarea = ({ value, onChange, language = "text", placeholder, style }) => {
    const textareaRef = useRef(null);

    return (
        <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "60px", ...style }}>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                spellCheck={false}
                className="ht-textarea"
                style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                    margin: 0, padding: "10px",
                    width: "100%", height: "100%",
                    overflow: "auto",
                    background: "transparent",
                    color: "#e4e4e7",
                    caretColor: "#a78bfa",
                    border: "none",
                    borderRadius: 0,
                    fontSize: "12.5px",
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    lineHeight: "1.6",
                    resize: "none",
                    outline: "none",
                    zIndex: 1,
                    boxSizing: "border-box",
                    letterSpacing: "0.2px",
                }}
            />
            <style>{`
                .ht-textarea::placeholder {
                    color: #3a3a3a;
                    font-style: normal;
                }
            `}</style>
        </div>
    );
};

export default HighlightedTextarea;
