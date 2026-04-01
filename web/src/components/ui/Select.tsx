import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "../../lib/utils";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  disabled?: boolean;
  searchable?: boolean;
}

export function Select({ options, value, onChange, placeholder = "Select option...", className, disabled, searchable = false }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = useMemo(() => {
    if (!searchable || !search) return options;
    const q = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, searchable, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable) {
      setSearch("");
      // Small timeout to ensure DOM is rendered
      setTimeout(() => searchInputRef.current?.focus(), 10);
    }
  }, [isOpen, searchable]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={containerRef} style={{ position: "relative", opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between px-4 py-2.5 bg-white border-2 border-gray-200 rounded-xl cursor-pointer transition-all hover:border-blue-400",
          isOpen && "border-blue-500 ring-4 ring-blue-500/10"
        )}
        style={{
          border: isOpen ? "2px solid var(--color-security-blue)" : "2px solid var(--color-border)",
          borderRadius: "0.75rem",
          padding: "0.625rem 1rem",
          backgroundColor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: isOpen ? "0 0 0 4px rgba(37, 99, 235, 0.1)" : "none",
        }}
      >
        <span className={cn("text-sm", !selectedOption && "text-gray-400")} style={{ color: selectedOption ? "var(--color-text-main)" : "var(--color-text-light)", fontSize: "0.875rem" }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={18} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} style={{ color: "var(--color-text-light)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </div>

      {isOpen && (
        <div
          className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.5rem",
            backgroundColor: "#fff",
            border: "1px solid var(--color-border)",
            borderRadius: "0.75rem",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            zIndex: 1000,
            maxHeight: "15.5rem",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {searchable && (
            <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "0.5rem", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              <Search size={16} style={{ color: "var(--color-text-light)" }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  fontSize: "0.875rem",
                  color: "var(--color-text-main)",
                  background: "transparent"
                }}
              />
            </div>
          )}
          
          <div style={{ overflowY: "auto", maxHeight: "12rem" }}>
            {filteredOptions.map((option) => (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: "0.75rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  backgroundColor: value === option.value ? "rgba(37, 99, 235, 0.05)" : "transparent",
                  color: value === option.value ? "var(--color-security-blue)" : "var(--color-text-main)",
                  fontSize: "0.875rem",
                  transition: "background-color 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (value !== option.value) e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.02)";
                }}
                onMouseLeave={(e) => {
                  if (value !== option.value) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span>{option.label}</span>
                {value === option.value && <Check size={16} />}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div style={{ padding: "1.5rem 1rem", textAlign: "center", color: "var(--color-text-light)", fontSize: "0.875rem" }}>
                No options available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
