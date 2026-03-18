import { useState, useEffect, useMemo } from "react";
import { Copy, RefreshCw, Check, ShieldCheck, ShieldAlert } from "lucide-react";
import { Label } from "../../../components/ui/Label";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { generatePassword, type PasswordOptions } from "../../../utils/password.utils";
import { cn } from "../../../lib/utils";
import "../../../styles/pwd-gen.css";

interface PasswordGeneratorProps {
  onUsePassword?: (password: string) => void;
  onCancel?: () => void;
  standalone?: boolean;
}

export function PasswordGenerator({ onUsePassword, onCancel, standalone = false }: PasswordGeneratorProps) {
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
  });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copied, setCopied] = useState(false);

  // Strength calculation logic
  const strength = useMemo(() => {
    let score = 0;
    if (!generatedPassword) return score;

    if (generatedPassword.length >= 12) score += 1;
    if (generatedPassword.length >= 20) score += 1;
    if (options.includeUppercase) score += 0.5;
    if (options.includeLowercase) score += 0.5;
    if (options.includeNumbers) score += 0.5;
    if (options.includeSymbols) score += 0.5;

    return Math.min(Math.floor(score), 4);
  }, [generatedPassword, options]);

  const strengthConfig = useMemo(() => {
    switch (strength) {
      case 0:
      case 1:
        return { label: "Weak", color: "var(--color-red)", width: "25%" };
      case 2:
        return { label: "Fair", color: "var(--color-amber)", width: "50%" };
      case 3:
        return { label: "Good", color: "var(--color-security-blue)", width: "75%" };
      case 4:
        return { label: "Strong", color: "var(--color-soft-green)", width: "100%" };
      default:
        return { label: "Weak", color: "var(--color-red)", width: "10%" };
    }
  }, [strength]);

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

  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
         <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ position: "relative" }}>
                <textarea
                  readOnly
                  value={generatedPassword}
                  className={cn("pwd-gen-textarea", standalone ? "standalone" : "inline")}
                  rows={standalone ? 2 : 1}
                />
                {!standalone && (
                  <div style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)" }}>
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={handleGenerate}
                        style={{ height: "2.5rem", width: "2.5rem" }}
                        title="Regenerate"
                    >
                        <RefreshCw size={18} style={{ color: "var(--color-text-subtle)" }} />
                    </Button>
                  </div>
                )}
            </div>
            
            <div className="pwd-gen-btns">
               {standalone && (
                  <Button 
                    variant="outline" 
                    onClick={handleGenerate}
                    style={{ flex: 1, height: "3.5rem", fontSize: "1rem", gap: "0.5rem" }}
                  >
                    <RefreshCw size={18} /> Regenerate
                  </Button>
               )}
               <Button 
                  className={cn("flex-1", !standalone && "hidden")}
                  onClick={handleCopy}
                  style={{ height: "3.5rem", fontSize: "1rem", gap: "0.5rem" }}
               >
                  {copied ? (
                    <><Check size={20} /> Copied</>
                  ) : (
                    <><Copy size={20} /> Copy Password</>
                  )}
               </Button>
               {!standalone && (
                  <Button 
                    variant="outline" 
                    onClick={handleCopy}
                    style={{ height: "3.5rem", padding: "0 1rem", flexShrink: 0 }}
                  >
                    {copied ? <Check size={20} className="text-green" /> : <Copy size={20} />}
                  </Button>
               )}
            </div>
         </div>

         {/* Strength Indicator */}
         <div style={{ padding: "0 0.5rem" }}>
            <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                marginBottom: "0.5rem", 
                fontSize: "0.875rem", 
                fontWeight: 600, 
                color: "var(--color-text-subtle)" 
            }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    {strength >= 3 ? <ShieldCheck size={16} className="text-green" /> : <ShieldAlert size={16} className="text-amber" />}
                    Password Strength: {strengthConfig.label}
                </span>
                <span>{Math.round((strength / 4) * 100)}%</span>
            </div>
            <div style={{ height: "0.5rem", width: "100%", backgroundColor: "var(--color-border)", borderRadius: "999px", overflow: "hidden" }}>
                <div 
                    style={{ 
                        height: "100%", 
                        transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                        width: strengthConfig.width, 
                        backgroundColor: strengthConfig.color,
                        boxShadow: `0 0 12px ${strengthConfig.color}60`
                    }}
                />
            </div>
         </div>
      </div>

      <div className={cn("pwd-gen-container", standalone && "standalone")} style={{ 
          backgroundColor: standalone ? "rgba(255,255,255,0.4)" : "transparent",
          border: standalone ? "1px solid var(--color-border)" : "none"
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label style={{ fontSize: "0.9375rem", color: "var(--color-text-main)", fontWeight: 600 }}>Password Length</Label>
            <span style={{ 
                fontSize: "1rem", 
                fontWeight: "bold", 
                color: "var(--color-security-blue)", 
                backgroundColor: "var(--color-white)", 
                padding: "0.25rem 0.75rem", 
                borderRadius: "0.5rem", 
                border: "1px solid var(--color-border)",
                minWidth: "3rem", 
                textAlign: "center" 
            }}>
                {options.length}
            </span>
          </div>
          <input
            type="range"
            min="8"
            max="128"
            value={options.length}
            onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value, 10) })}
            style={{ 
                width: "100%", 
                height: "0.625rem", 
                backgroundColor: "var(--color-border)", 
                borderRadius: "0.5rem", 
                outline: "none", 
                cursor: "pointer", 
                accentColor: "var(--color-security-blue)",
                background: `linear-gradient(to right, var(--color-security-blue) 0%, var(--color-security-blue) ${((options.length - 8) / (128 - 8)) * 100}%, var(--color-border) ${((options.length - 8) / (128 - 8)) * 100}%, var(--color-border) 100%)`
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-light)", fontSize: "0.75rem" }}>
            <span>8</span>
            <span>64</span>
            <span>128</span>
          </div>
        </div>

        <div className="pwd-gen-options">
          <OptionToggle 
            label="Uppercase" 
            checked={options.includeUppercase} 
            onChange={() => toggleOption("includeUppercase")} 
          />
          <OptionToggle 
            label="Lowercase" 
            checked={options.includeLowercase} 
            onChange={() => toggleOption("includeLowercase")} 
          />
          <OptionToggle 
            label="Numbers" 
            checked={options.includeNumbers} 
            onChange={() => toggleOption("includeNumbers")} 
          />
          <OptionToggle 
            label="Symbols" 
            checked={options.includeSymbols} 
            onChange={() => toggleOption("includeSymbols")} 
          />
        </div>
      </div>

      {!standalone && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" }}>
          <Button variant="ghost" onClick={onCancel} style={{ padding: "0 1.5rem" }}>
            Cancel
          </Button>
          <Button onClick={() => onUsePassword?.(generatedPassword)} style={{ padding: "0 1.5rem" }}>
            Use Password
          </Button>
        </div>
      )}
    </div>
  );

  if (standalone) {
    return (
      <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
        <div style={{ marginBottom: "2.5rem", textAlign: "center" }}>
            <h1 className="pwd-gen-title">Password Generator</h1>
            <p style={{ fontSize: "1.125rem", color: "var(--color-text-subtle)", maxWidth: "32rem", margin: "0 auto" }}>
              Secure your digital life with enterprise-grade random passwords.
            </p>
        </div>
        <Card className="pwd-gen-card">
          {content}
        </Card>
      </div>
    );
  }

  return content;
}

function OptionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--color-border)",
        transition: "all 0.2s",
        cursor: "pointer",
        userSelect: "none",
        backgroundColor: checked ? "rgba(37, 99, 235, 0.05)" : "var(--color-white)",
        color: checked ? "var(--color-security-blue)" : "var(--color-text-subtle)",
        borderColor: checked ? "rgba(37, 99, 235, 0.3)" : "var(--color-border)"
    }}>
      <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ height: "1rem", width: "1rem", borderRadius: "0.25rem", cursor: "pointer", accentColor: "var(--color-security-blue)" }}
      />
    </label>
  );
}
