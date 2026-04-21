import { useState } from "react";
import { User, Shield, Palette, Info, ChevronRight, History, Database } from "lucide-react";
import { ProfileSection } from "../components/ProfileSection";
import { SecuritySection } from "../components/SecuritySection";
import { AppearanceSection } from "../components/AppearanceSection";
import { ChangelogSection } from "../components/ChangelogSection";
import { DataSection } from "../components/DataSection";
import { Button } from "../../../components/ui/Button";

type SettingsTab = "profile" | "security" | "appearance" | "about" | "changelog" | "data";

export function Settings() {
    const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

    const tabs = [
        { id: "profile", label: "Profile", icon: User, description: "Personal info & account" },
        { id: "security", label: "Security", icon: Shield, description: "2FA & recovery" },
        { id: "appearance", label: "Appearance", icon: Palette, description: "Theme & interface" },
        { id: "data", label: "Data", icon: Database, description: "Import & export" },
        { id: "changelog", label: "Changelog", icon: History, description: "Updates & version history" },
        { id: "about", label: "About", icon: Info, description: "System info" }
    ] as const;

    const renderContent = () => {
        switch (activeTab) {
            case "profile": return <ProfileSection />;
            case "security": return <SecuritySection />;
            case "appearance": return <AppearanceSection />;
            case "changelog": return <ChangelogSection />;
            case "data": return <DataSection />;
            case "about": return <AboutSection onNavigate={setActiveTab} />;
            default: return <ProfileSection />;
        }
    };

    return (
        <div 
            className="settings-page"
        >
            <div className="settings-mobile-title">
                <h1>Settings</h1>
                <p>Fine-tune security, appearance, and account preferences.</p>
            </div>

            {/* Mobile Tab Navigation */}
            <div className="settings-mobile-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="settings-mobile-tab-btn"
                        style={{
                            background: activeTab === tab.id ? "var(--color-security-blue)" : "var(--color-bg-base)",
                            color: activeTab === tab.id ? "white" : "var(--color-text-subtle)",
                            borderColor: activeTab === tab.id ? "var(--color-security-blue)" : "var(--color-border)",
                        }}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Desktop Settings Navigation */}
            <aside className="settings-sidebar">
                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-text-main)", marginBottom: "2rem", paddingLeft: "0.5rem" }}>
                    Settings
                </h2>
                <nav className="settings-sidebar-nav">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="settings-sidebar-tab"
                            data-active={activeTab === tab.id}
                        >
                            <div className="settings-sidebar-tab-icon">
                                <tab.icon size={18} />
                            </div>
                            <div className="settings-sidebar-tab-copy">
                                <div style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{tab.label}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--color-text-light)", marginTop: "0.1rem" }}>{tab.description}</div>
                            </div>
                            {activeTab === tab.id && <ChevronRight size={16} />}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Content Area */}
            <main className="settings-content-shell" style={{ animation: "fadeIn 0.3s ease-out" }}>
                <div className="settings-content-card">
                    {renderContent()}
                </div>
            </main>
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

                <div className="flex-responsive" style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1.5rem" }}>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-light)", textAlign: "center", lineHeight: 1.6, margin: 0 }}>
                        © 2026 Family Vault. <br />
                    </p>
                </div>
            </div>
        </div>
    );
}
