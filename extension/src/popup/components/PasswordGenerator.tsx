import { useState, useEffect, useMemo } from "react";
import { Copy, RefreshCw, Check, ShieldCheck, ShieldAlert } from "lucide-react";
import { generatePassword, type PasswordOptions } from "../../shared/password.utils";

export function PasswordGenerator() {
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
  });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copied, setCopied] = useState(false);

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
      if (
        !next.includeUppercase &&
        !next.includeLowercase &&
        !next.includeNumbers &&
        !next.includeSymbols
      ) {
        return { ...next, includeLowercase: true };
      }
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Output */}
      <textarea
        readOnly
        value={generatedPassword}
        className="pwdgen-output"
        rows={2}
      />

      {/* Actions */}
      <div className="pwdgen-actions">
        <button
          className="btn btn-outline"
          onClick={handleGenerate}
          style={{ flex: 1, gap: "0.375rem" }}
        >
          <RefreshCw size={14} />
          Regenerate
        </button>
        <button
          className="btn btn-primary"
          onClick={handleCopy}
          style={{ flex: 1, gap: "0.375rem" }}
        >
          {copied ? (
            <>
              <Check size={14} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Strength */}
      <div>
        <div className="pwdgen-strength">
          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            {strength >= 3 ? (
              <ShieldCheck size={14} className="text-green" />
            ) : (
              <ShieldAlert size={14} className="text-amber" />
            )}
            {strengthConfig.label}
          </span>
          <span>{Math.round((strength / 4) * 100)}%</span>
        </div>
        <div className="pwdgen-strength-bar">
          <div
            className="pwdgen-strength-fill"
            style={{
              width: strengthConfig.width,
              backgroundColor: strengthConfig.color,
              boxShadow: `0 0 12px ${strengthConfig.color}60`,
            }}
          />
        </div>
      </div>

      {/* Length Slider */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.375rem",
          }}
        >
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--color-text-main)",
            }}
          >
            Length
          </span>
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: "bold",
              color: "#fff",
              backgroundColor: "var(--color-security-blue)",
              padding: "0.125rem 0.5rem",
              borderRadius: "0.375rem",
              minWidth: "2.5rem",
              textAlign: "center",
            }}
          >
            {options.length}
          </span>
        </div>
        <input
          type="range"
          min="8"
          max="128"
          value={options.length}
          onChange={(e) =>
            setOptions({ ...options, length: parseInt(e.target.value, 10) })
          }
          style={{
            width: "100%",
            height: "0.5rem",
            borderRadius: "0.5rem",
            outline: "none",
            cursor: "pointer",
            accentColor: "var(--color-security-blue)",
            background: `linear-gradient(to right, var(--color-security-blue) 0%, var(--color-security-blue) ${((options.length - 8) / (128 - 8)) * 100}%, var(--color-border) ${((options.length - 8) / (128 - 8)) * 100}%, var(--color-border) 100%)`,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "var(--color-text-light)",
            fontSize: "0.6875rem",
            marginTop: "0.25rem",
          }}
        >
          <span>8</span>
          <span>64</span>
          <span>128</span>
        </div>
      </div>

      {/* Options */}
      <div className="pwdgen-options">
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
  );
}

function OptionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`pwdgen-option ${checked ? "active" : ""}`}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{
          height: "0.875rem",
          width: "0.875rem",
          borderRadius: "0.25rem",
          cursor: "pointer",
          accentColor: "var(--color-security-blue)",
        }}
      />
    </label>
  );
}
