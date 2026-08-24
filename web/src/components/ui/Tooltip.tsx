import React, { useState } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
}

export function Tooltip({ content, children, maxWidth = 220 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      style={{ position: "relative", display: "inline-flex", justifyContent: "center" }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translate(-50%, -0.25rem)",
            padding: "0.5rem 0.625rem",
            backgroundColor: "var(--color-text-main)",
            color: "var(--color-bg-base)",
            fontSize: "0.75rem",
            fontWeight: 500,
            lineHeight: 1.4,
            borderRadius: "0.375rem",
            whiteSpace: "normal",
            textAlign: "left",
            width: `${maxWidth}px`,
            boxShadow: "var(--shadow-md)",
            zIndex: 100,
            pointerEvents: "none",
            animation: "fadeIn 0.15s ease-out forwards",
        }}>
          {content}
          <div style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            borderWidth: "4px",
            borderStyle: "solid",
            borderColor: "var(--color-text-main) transparent transparent transparent"
          }} />
        </div>
      )}
    </div>
  );
}
