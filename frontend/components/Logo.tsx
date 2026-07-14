import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textColor?: string;
}

export default function Logo({ size = 28, className = "", showText = false, textColor = "var(--text-primary)" }: LogoProps) {
  return (
    <div className={`repodar-logo-container ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="repodar-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0052FF" />
            <stop offset="100%" stopColor="#00D48A" />
          </linearGradient>
        </defs>
        
        {/* Outer R Shell */}
        <path
          d="M 35 90 
             V 42 
             C 35 28, 46 20, 60 20 
             C 75 20, 85 30, 85 45 
             C 85 58, 75 66, 60 66 
             L 78 85 
             H 88" 
          stroke="url(#repodar-grad)" 
          strokeWidth="6" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />

        {/* Outer middle arc */}
        <path
          d="M 40 45 
             A 20 20 0 0 1 60 25 
             A 20 20 0 0 1 74.1 30.9" 
          stroke="url(#repodar-grad)" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
        />

        {/* Inner circle */}
        <path
          d="M 60 33 
             A 12 12 0 1 0 70.4 39" 
          stroke="url(#repodar-grad)" 
          strokeWidth="3.5" 
          strokeLinecap="round" 
        />

        {/* Diagonal line */}
        <line
          x1="60"
          y1="45"
          x2="82"
          y2="23"
          stroke="url(#repodar-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Nodes / Dots */}
        {/* Center dot */}
        <circle cx="60" cy="45" r="3.5" fill="url(#repodar-grad)" />
        {/* Diagonal top-right dot */}
        <circle cx="82" cy="23" r="4" fill="url(#repodar-grad)" />
        {/* Inner circle bottom-right dot */}
        <circle cx="68.5" cy="53.5" r="3" fill="url(#repodar-grad)" />
        {/* Middle arc dot 1 (left) */}
        <circle cx="40" cy="45" r="3" fill="url(#repodar-grad)" />
        {/* Middle arc dot 2 (middle) */}
        <circle cx="45.9" cy="30.9" r="3" fill="url(#repodar-grad)" />
        {/* Middle arc dot 3 (top) */}
        <circle cx="60" cy="25" r="3" fill="url(#repodar-grad)" />
      </svg>
      {showText && (
        <span
          style={{
            fontFamily: "var(--font-sans, system-ui, sans-serif)",
            fontWeight: 800,
            fontSize: `${Math.max(14, size * 0.7)}px`,
            letterSpacing: "-0.02em",
            color: textColor,
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          Repodar
        </span>
      )}
    </div>
  );
}
