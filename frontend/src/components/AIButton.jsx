import React, { useState } from "react";

export default function AIButton({ onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "fixed",
        right: "24px",
        bottom: "24px",
        width: "64px",  // Slightly larger for a "premium" feel
        height: "64px",
        borderRadius: "50%",
        
        // Pure White Background
        background: "#FFFFFF",
        border: "none",
        cursor: "pointer",
        
        // Refined "Floating" Shadow
        boxShadow: isHovered 
          ? "0 10px 25px rgba(0,0,0,0.15), 0 4px 10px rgba(0,0,0,0.05)" // Deeper shadow on hover
          : "0 4px 12px rgba(0,0,0,0.1)", // Soft shadow normally
          
        transform: isHovered ? "translateY(-2px) scale(1.05)" : "translateY(0) scale(1)",
        transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)", // smooth animation
        
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      {/* SVG Container */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="36"   /* INCREASED SIZE: This makes the icon pop */
        height="36"
        style={{
             // Optional: Rotates the star slightly on hover
             transition: "transform 0.5s ease",
             transform: isHovered ? "rotate(90deg)" : "rotate(0deg)"
        }}
      >
        {/* Definition of the Official Gemini Gradient */}
        <defs>
          <linearGradient id="geminiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#4E79FF", stopOpacity: 1 }} />  {/* Blue */}
            <stop offset="50%" style={{ stopColor: "#9859FF", stopOpacity: 1 }} />  {/* Purple */}
            <stop offset="100%" style={{ stopColor: "#F37F5F", stopOpacity: 1 }} /> {/* Peach/Orange */}
          </linearGradient>
        </defs>
        
        {/* The Star Path - Filled with the Gradient */}
        <path 
          fill="url(#geminiGradient)" 
          d="M19 15l-1.25-2.75L15 11l2.75-1.25L19 7l1.25 2.75L23 11l-2.75 1.25zM10 2l2.5 5.5L18 10l-5.5 2.5L10 18l-2.5-5.5L2 10l5.5-2.5z" 
        />
      </svg>
    </button>
  );
}