import React, { useState, useRef, useEffect } from "react";
import { X, Plus, ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  disabled?: boolean;
}

export function MultiSelect({ options, value, onChange, placeholder = "Add tags...", className, disabled }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRemoveTag = (tag: string) => {
    if (disabled) return;
    onChange(value.filter((t) => t !== tag));
  };

  const handleAddTag = (tag: string) => {
    if (disabled) return;
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue("");
    setIsOpen(false);
  };

  const filteredOptions = options.filter(
    (opt) => 
      opt.toLowerCase().includes(inputValue.toLowerCase()) && 
      !value.includes(opt)
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" && inputValue) {
      e.preventDefault();
      handleAddTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      handleRemoveTag(value[value.length - 1]);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={containerRef} style={{ position: "relative", opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 transition-all cursor-text",
          isOpen && "ring-4 ring-blue-500/10"
        )}
        onClick={() => !disabled && inputRef.current?.focus()}
        style={{
          border: isOpen ? "2px solid var(--color-security-blue)" : "2px solid var(--color-border)",
          borderRadius: "0.75rem",
          minHeight: "3rem",
          padding: "0.4rem 0.6rem",
          backgroundColor: "var(--color-white)",
          display: "flex",
          position: "relative",
          paddingRight: "2.5rem",
          boxShadow: isOpen ? "0 0 0 4px rgba(37, 99, 235, 0.1)" : "none",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", flex: 1, marginRight: "1.5rem", alignItems: "center" }}>
            {value.map((tag) => (
            <span
                key={tag}
                style={{
                padding: "0.125rem 0.5rem",
                backgroundColor: "var(--color-blue-subtle)",
                color: "var(--color-security-blue)",
                borderRadius: "0.375rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                whiteSpace: "nowrap"
                }}
            >
                {tag}
                <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag);
                }}
                style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--color-security-blue)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                }}
                >
                <X size={12} />
                </button>
            </span>
            ))}
            <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
                setInputValue(e.target.value);
                setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ""}
            style={{
                flex: "1 1 auto",
                outline: "none",
                border: "none",
                background: "transparent",
                fontSize: "0.875rem",
                color: "var(--color-text-main)",
                minWidth: "3rem",
                padding: "0.125rem 0",
            }}
            />
        </div>
        
        <div 
          style={{ 
            position: "absolute",
            right: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            pointerEvents: "none"
          }}
        >
          <ChevronDown 
            size={20} 
            className={cn("text-gray-400 transition-transform duration-200", isOpen && "rotate-180")}
            style={{ 
              color: "var(--color-text-light)",
            }} 
          />
        </div>
      </div>


      {isOpen && (filteredOptions.length > 0 || inputValue) && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.5rem",
            backgroundColor: "var(--color-white)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.75rem",
            boxShadow: "var(--shadow-md)",
            zIndex: 1000,
            maxHeight: "15rem",
            overflowY: "auto",
          }}
        >
          {inputValue && !options.includes(inputValue) && !value.includes(inputValue) && (
            <div
              onClick={() => handleAddTag(inputValue)}
              style={{
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
                color: "var(--color-security-blue)",
                fontSize: "0.875rem",
                fontWeight: 600,
                borderBottom: filteredOptions.length > 0 ? "1px solid var(--color-border)" : "none",
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--color-blue-subtle)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <Plus size={16} /> Add "{inputValue}"
            </div>
          )}
          {filteredOptions.map((option) => (
            <div
              key={option}
              onClick={() => handleAddTag(option)}
              style={{
                padding: "0.75rem 1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                color: "var(--color-text-main)",
                fontSize: "0.875rem",
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(128, 128, 128, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              {option}
              {value.includes(option) && <Check size={16} style={{ color: "var(--color-security-blue)" }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
