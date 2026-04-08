import { Shield, Lock, Settings, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

interface PopupHeaderProps {
  email?: string;
  isUnlocked: boolean;
  onLock: () => void;
  activeTab: "vault" | "generator" | "settings";
  onTabChange: (tab: "vault" | "generator" | "settings") => void;
}

export function PopupHeader({
  email,
  isUnlocked,
  onLock,
  activeTab,
  onTabChange,
}: PopupHeaderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDark(prefersDark);
    if (prefersDark) document.documentElement.classList.add("dark");
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  return (
    <>
      <header className="popup-header">
        <div
          className="popup-header-left"
          onClick={() => onTabChange("vault")}
          title="Go to Vault"
        >
          <div className="popup-logo">
            <Shield size={16} />
          </div>
          <span className="popup-title">PMV2</span>
        </div>

        <div className="popup-header-actions">
          {email && (
            <span
              style={{
                fontSize: "0.6875rem",
                color: "var(--color-text-light)",
                marginRight: "0.25rem",
                maxWidth: "120px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={email}
            >
              {email}
            </span>
          )}
          <button
            className="popup-icon-btn"
            onClick={toggleTheme}
            title={isDark ? "Light mode" : "Dark mode"}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {isUnlocked && (
            <button
              className="popup-icon-btn"
              onClick={onLock}
              title="Lock vault"
            >
              <Lock size={15} />
            </button>
          )}
          <button
            className="popup-icon-btn"
            onClick={() => onTabChange("settings")}
            title="Settings"
            style={activeTab === "settings" ? { color: "var(--color-security-blue)" } : {}}
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {isUnlocked && activeTab !== "settings" && (
        <nav className="popup-tabs">
          <button
            className={`popup-tab ${activeTab === "vault" ? "active" : ""}`}
            onClick={() => onTabChange("vault")}
          >
            <Shield size={14} />
            Vault
          </button>
          <button
            className={`popup-tab ${activeTab === "generator" ? "active" : ""}`}
            onClick={() => onTabChange("generator")}
          >
            <Lock size={14} />
            Generator
          </button>
        </nav>
      )}
    </>
  );
}
