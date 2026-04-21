import { useState, useEffect } from "react";
import { Moon, Sun, Layout, EyeOff } from "lucide-react";
import { useTheme } from "../../../app/providers/ThemeProvider";

export function AppearanceSection() {
    const { theme, setTheme } = useTheme();
    const [density, setDensity] = useState(() => localStorage.getItem("ui-density") || "default");

    const [maskSensitive, setMaskSensitive] = useState(() => localStorage.getItem("mask-sensitive") === "true");

    useEffect(() => {
        localStorage.setItem("ui-density", density);
        document.documentElement.setAttribute("data-density", density);
    }, [density]);

    useEffect(() => {
        localStorage.setItem("mask-sensitive", String(maskSensitive));
    }, [maskSensitive]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div className="settings-section-header" style={{ padding: "0 0.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-main)", marginBottom: "0.5rem" }}>
                    Appearance
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: 0 }}>
                    Customize how you see and interact with the application.
                </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Theme Selector - Enhanced */}
                <div className="settings-card-tight" style={{
                    padding: "1.5rem",
                    borderRadius: "var(--radius-xl)",
                    background: "var(--color-bg-surface, var(--color-white))",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)"
                }}>
                    <div className="settings-split-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "1rem" }}>
                        <div>
                            <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-main)", margin: 0 }}>Color Theme</h4>
                            <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", marginTop: "0.25rem" }}>Choose your preferred color scheme.</p>
                        </div>
                        <div className="settings-choice-group settings-choice-group--triple" style={{ 
                            display: "inline-flex", 
                            background: "var(--color-soft-gray)", 
                            padding: "0.25rem", 
                            borderRadius: "var(--radius-lg, 0.75rem)",
                            border: "1px solid var(--color-border)"
                        }}>
                            {["light", "system", "dark"].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTheme(t as any)}
                                    style={{
                                        padding: "0.5rem 1rem",
                                        fontSize: "0.875rem",
                                        fontWeight: 600,
                                        borderRadius: "var(--radius-md, 0.5rem)",
                                        background: theme === t ? "var(--color-white)" : "transparent",
                                        color: theme === t ? "var(--color-security-blue)" : "var(--color-text-subtle)",
                                        boxShadow: theme === t ? "var(--shadow-sm)" : "none",
                                        transition: "all 0.2s ease",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        textTransform: "capitalize",
                                        border: "none",
                                        cursor: "pointer"
                                    }}
                                >
                                    {t === "light" && <Sun size={14} />}
                                    {t === "dark" && <Moon size={14} />}
                                    {t === "system" && <Layout size={14} />}
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* UI Density */}
                <div className="settings-card-tight" style={{
                    padding: "1.5rem",
                    borderRadius: "var(--radius-xl)",
                    background: "var(--color-bg-surface, var(--color-white))",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)"
                }}>
                    <div className="settings-split-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                        <div>
                            <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-main)", margin: 0 }}>Interface Density</h4>
                            <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", marginTop: "0.25rem" }}>Adjust the layout to show more or less information.</p>
                        </div>
                        <div className="settings-choice-group" style={{ 
                            display: "inline-flex", 
                            background: "var(--color-soft-gray)", 
                            padding: "0.25rem", 
                            borderRadius: "var(--radius-lg, 0.75rem)",
                            border: "1px solid var(--color-border)"
                        }}>
                             <button
                                onClick={() => setDensity("default")}
                                style={{
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.875rem",
                                    fontWeight: 600,
                                    borderRadius: "var(--radius-md, 0.5rem)",
                                    background: density === "default" ? "var(--color-white)" : "transparent",
                                    color: density === "default" ? "var(--color-security-blue)" : "var(--color-text-subtle)",
                                    boxShadow: density === "default" ? "var(--shadow-sm)" : "none",
                                    transition: "all 0.2s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem"
                                }}
                            >
                                <Layout size={14} />
                                Default
                            </button>
                            <button
                                onClick={() => setDensity("compact")}
                                style={{
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.875rem",
                                    fontWeight: 600,
                                    borderRadius: "var(--radius-md, 0.5rem)",
                                    background: density === "compact" ? "var(--color-white)" : "transparent",
                                    color: density === "compact" ? "var(--color-security-blue)" : "var(--color-text-subtle)",
                                    boxShadow: density === "compact" ? "var(--shadow-sm)" : "none",
                                    transition: "all 0.2s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem"
                                }}
                            >
                                <Layout size={14} style={{ transform: "scale(0.85)" }} />
                                Compact
                            </button>
                        </div>
                    </div>
                </div>

                {/* Security Masking */}
                <div className="settings-card-tight" style={{
                    padding: "1.5rem",
                    borderRadius: "var(--radius-xl)",
                    background: "var(--color-bg-surface, var(--color-white))",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)"
                }}>
                    <div className="settings-split-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                            <div style={{
                                width: "2.5rem",
                                height: "2.5rem",
                                borderRadius: "var(--radius-lg, 0.75rem)",
                                background: "rgba(37, 99, 235, 0.1)",
                                color: "var(--color-security-blue)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                            }}>
                                <EyeOff size={20} />
                            </div>
                            <div>
                                <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-main)", margin: 0 }}>Privacy & Security</h4>
                                <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", marginTop: "0.25rem" }}>
                                    Hide passwords and sensitive data in menus by default.
                                </p>
                            </div>
                        </div>
                        <label style={{ 
                            position: "relative", 
                            display: "inline-block", 
                            width: "3rem", 
                            height: "1.5rem",
                            cursor: "pointer"
                        }}>
                            <input 
                                type="checkbox" 
                                checked={maskSensitive} 
                                onChange={(e) => setMaskSensitive(e.target.checked)}
                                style={{ opacity: 0, width: 0, height: 0 }} 
                            />
                            <span style={{
                                position: "absolute",
                                cursor: "pointer",
                                top: 0, left: 0, right: 0, bottom: 0,
                                backgroundColor: maskSensitive ? "var(--color-security-blue)" : "var(--color-border)",
                                borderRadius: "34px",
                                transition: "0.4s",
                            }}></span>
                            <span style={{
                                position: "absolute",
                                height: "1.125rem",
                                width: "1.125rem",
                                left: maskSensitive ? "1.625rem" : "0.20rem",
                                bottom: "0.20rem",
                                backgroundColor: "white",
                                borderRadius: "50%",
                                transition: "0.4s",
                            }}></span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
