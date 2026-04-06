import React, { useState } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
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
            padding: "0.375rem 0.625rem",
            backgroundColor: "var(--color-text-main)",
            color: "var(--color-bg-base)",
            fontSize: "0.75rem",
            fontWeight: 600,
            borderRadius: "0.375rem",
            whiteSpace: "nowrap",
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
