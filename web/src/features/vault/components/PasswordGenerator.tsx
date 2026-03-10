import { useState, useEffect } from "react";
import { Copy, RefreshCw, Check } from "lucide-react";
import { Label } from "../../../components/ui/Label";
import { Button } from "../../../components/ui/Button";
import { generatePassword, type PasswordOptions } from "../../../utils/password.utils";

interface PasswordGeneratorProps {
  onUsePassword: (password: string) => void;
  onCancel: () => void;
}

export function PasswordGenerator({ onUsePassword, onCancel }: PasswordGeneratorProps) {
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
  });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copied, setCopied] = useState(false);

  // Generate on mount and when options change
  useEffect(() => {
    handleGenerate();
  }, [options]);

  const handleGenerate = () => {
    setGeneratedPassword(generatePassword(options));
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleOption = (key: keyof Omit<PasswordOptions, "length">) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Prevent unchecking all character types. Force lowercase if they try to uncheck the last one.
      if (!next.includeUppercase && !next.includeLowercase && !next.includeNumbers && !next.includeSymbols) {
        return { ...next, includeLowercase: true };
      }
      return next;
    });
  };

  return (
    <div
      style={{
        padding: "1rem",
        backgroundColor: "var(--color-bg-subtle)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border)",
        marginTop: "0.5rem",
      }}
    >
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
        <input
          type="text"
          value={generatedPassword}
          readOnly
          className="input"
          style={{
            flex: 1,
            fontFamily: "monospace",
            fontSize: "1.125rem",
            letterSpacing: "0.05em",
            backgroundColor: "var(--color-bg)",
          }}
        />
        <Button variant="outline" type="button" onClick={handleCopy} aria-label="Copy password">
          {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
        </Button>
        <Button variant="outline" type="button" onClick={handleGenerate} aria-label="Regenerate">
          <RefreshCw size={18} />
        </Button>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <Label htmlFor="password-length">Length: {options.length}</Label>
        </div>
        <input
          id="password-length"
          type="range"
          min="8"
          max="128"
          value={options.length}
          onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value, 10) })}
          style={{ width: "100%", accentColor: "var(--color-primary)" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={options.includeUppercase}
            onChange={() => toggleOption("includeUppercase")}
            style={{ accentColor: "var(--color-primary)", width: "1rem", height: "1rem" }}
          />
          A-Z (Uppercase)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={options.includeLowercase}
            onChange={() => toggleOption("includeLowercase")}
            style={{ accentColor: "var(--color-primary)", width: "1rem", height: "1rem" }}
          />
          a-z (Lowercase)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={options.includeNumbers}
            onChange={() => toggleOption("includeNumbers")}
            style={{ accentColor: "var(--color-primary)", width: "1rem", height: "1rem" }}
          />
          0-9 (Numbers)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={options.includeSymbols}
            onChange={() => toggleOption("includeSymbols")}
            style={{ accentColor: "var(--color-primary)", width: "1rem", height: "1rem" }}
          />
          !@# (Symbols)
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
        <Button variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={() => onUsePassword(generatedPassword)}>
          Use Password
        </Button>
      </div>
    </div>
  );
}
