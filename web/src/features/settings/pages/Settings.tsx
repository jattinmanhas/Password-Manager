import { useState } from "react";
import { User, Shield, Palette, Info, ChevronRight, History } from "lucide-react";
import { ProfileSection } from "../components/ProfileSection";
import { SecuritySection } from "../components/SecuritySection";
import { AppearanceSection } from "../components/AppearanceSection";
import { ChangelogSection } from "../components/ChangelogSection";
import { Button } from "../../../components/ui/Button";

type SettingsTab = "profile" | "security" | "appearance" | "about" | "changelog";

export function Settings() {
    const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

    const tabs = [
        { id: "profile", label: "Profile", icon: User, description: "Personal info & account" },
        { id: "security", label: "Security", icon: Shield, description: "2FA & recovery" },
        { id: "appearance", label: "Appearance", icon: Palette, description: "Theme & interface" },
        { id: "changelog", label: "Changelog", icon: History, description: "Updates & version history" },
        { id: "about", label: "About", icon: Info, description: "System info" }
    ] as const;

    const renderContent = () => {
        switch (activeTab) {
            case "profile": return <ProfileSection />;
            case "security": return <SecuritySection />;
            case "appearance": return <AppearanceSection />;
            case "changelog": return <ChangelogSection />;
            case "about": return <AboutSection onNavigate={setActiveTab} />;
            default: return <ProfileSection />;
        }
    };

    return (
        <div style={{ 
            display: "flex", 
            gap: "2.5rem", 
            padding: "1rem",
            maxWidth: "1100px",
            margin: "0 auto",
            minHeight: "calc(100vh - 8rem)"
        }}>
            {/* Settings Navigation */}
            <aside style={{ width: "260px", flexShrink: 0 }}>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-text-main)", marginBottom: "2rem", paddingLeft: "0.5rem" }}>
                    Settings
                </h2>
                <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.875rem",
                                padding: "0.875rem 1rem",
                                borderRadius: "var(--radius-xl)",
                                background: activeTab === tab.id ? "var(--color-bg-surface, var(--color-white))" : "transparent",
                                border: "1px solid",
                                borderColor: activeTab === tab.id ? "var(--color-border)" : "transparent",
                                boxShadow: activeTab === tab.id ? "var(--shadow-sm)" : "none",
                                textAlign: "left",
                                transition: "all 0.2s ease",
                                cursor: "pointer",
                                width: "100%",
                                color: activeTab === tab.id ? "var(--color-security-blue)" : "var(--color-text-subtle)",
                            }}
                        >
                            <div style={{
                                width: "2rem",
                                height: "2rem",
                                borderRadius: "var(--radius-lg, 0.75rem)",
                                background: activeTab === tab.id ? "rgba(37, 99, 235, 0.1)" : "var(--color-soft-gray)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.2s ease"
                            }}>
                                <tab.icon size={18} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{tab.label}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--color-text-light)", marginTop: "0.1rem" }}>{tab.description}</div>
                            </div>
                            {activeTab === tab.id && <ChevronRight size={16} />}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Content Area */}
            <main style={{ flex: 1, minWidth: 0, animation: "fadeIn 0.3s ease-out" }}>
                <div style={{
                    background: "var(--color-white)",
                    borderRadius: "var(--radius-2xl)",
                    padding: "2.5rem",
                    minHeight: "500px",
                    border: "1px solid var(--color-border)",
                    boxShadow: "var(--shadow-sm)"
                }}>
                    {renderContent()}
                </div>
            </main>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            ` }} />
        </div>
    );
}

function AboutSection({ onNavigate }: { onNavigate: (tab: "changelog") => void }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div style={{ padding: "0 0.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-main)", marginBottom: "0.5rem" }}>
                    About PMV2
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: 0 }}>
                    Modern, secure, and self-hosted password management.
                </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{
                    padding: "1.5rem",
                    borderRadius: "var(--radius-xl)",
                    background: "var(--color-bg-surface, var(--color-white))",
                    border: "1px solid var(--color-border)",
                    textAlign: "center"
                }}>
                    <div style={{ 
                        width: "4rem", height: "4rem", background: "var(--color-security-blue)", 
                        borderRadius: "1.25rem", color: "white", display: "flex", 
                        alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem"
                    }}>
                        <Shield size={32} />
                    </div>
                    <h4 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0 0 0.5rem 0" }}>Family Vault</h4>
                    <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: "0 0 1.5rem 0" }}>Version 0.2.1-beta (Current Version)</p>
                    
                    <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                        <Button variant="outline" size="sm" onClick={() => onNavigate("changelog")}>View Changelog</Button>
                    </div>
                </div>

                <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-light)", textAlign: "center", lineHeight: 1.6 }}>
                        © 2026 Family Vault. <br />
                    </p>
                </div>
            </div>
        </div>
    );
}

