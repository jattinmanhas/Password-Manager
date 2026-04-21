import { History, CheckCircle, Star, Shield, Zap } from "lucide-react";

export function ChangelogSection() {
    const defaultColor = "var(--color-security-blue)";

    const versionHistory = [
        {
            version: "0.2.1-beta",
            date: "April 5, 2026",
            badge: "Latest",
            updates: [
                { type: "feature", text: "Added support for System Theme auto-switching", icon: Zap, color: defaultColor },
                { type: "feature", text: "Introduced inline Display Name editing in Profile", icon: Star, color: "#eab308" },
                { type: "improvement", text: "Refactored Appearance settings for better UX", icon: CheckCircle, color: "#10b981" },
            ]
        },
        {
            version: "0.2.0-beta",
            date: "March 20, 2026",
            badge: "",
            updates: [
                { type: "feature", text: "Implemented secure Family Vault sharing", icon: Shield, color: "#8b5cf6" },
                { type: "improvement", text: "Enhanced dark mode aesthetics and contrast", icon: CheckCircle, color: "#10b981" },
                { type: "fix", text: "Fixed session state persistence bug on logout", icon: CheckCircle, color: "#10b981" }
            ]
        },
        {
            version: "0.1.0-alpha",
            date: "February 10, 2026",
            badge: "",
            updates: [
                { type: "release", text: "Initial alpha release of PMV2", icon: Star, color: "#eab308" },
                { type: "feature", text: "End-to-end encryption for stored credentials", icon: Shield, color: "#8b5cf6" },
                { type: "feature", text: "Basic TOTP 2FA support", icon: Shield, color: "#8b5cf6" }
            ]
        }
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
            <div className="settings-section-header" style={{ padding: "0 0.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-main)", marginBottom: "0.5rem" }}>
                    Changelog
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: 0 }}>
                    Track new features, improvements, and bug fixes across updates.
                </p>
            </div>

            <div className="settings-timeline" style={{ display: "flex", flexDirection: "column", gap: "2rem", paddingLeft: "0.5rem" }}>
                {versionHistory.map((release, index) => (
                    <div key={release.version} style={{ position: "relative" }}>
                        {index !== versionHistory.length - 1 && (
                            <div style={{
                                position: "absolute",
                                left: "0.625rem",
                                top: "2.5rem",
                                bottom: "-2.5rem",
                                width: "2px",
                                background: "var(--color-border)",
                                zIndex: 0
                            }} />
                        )}

                        <div className="settings-timeline-entry" style={{ display: "flex", gap: "1.5rem", position: "relative", zIndex: 1 }}>
                            <div style={{
                                width: "1.25rem",
                                height: "1.25rem",
                                borderRadius: "50%",
                                background: release.badge === "Latest" ? "var(--color-security-blue)" : "var(--color-border)",
                                border: "4px solid var(--color-bg-surface, var(--color-white))",
                                flexShrink: 0,
                                marginTop: "0.25rem"
                            }} />
                            
                            <div style={{ flex: 1 }}>
                                <div className="settings-release-header" style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                                    <h4 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text-main)", margin: 0 }}>
                                        v{release.version}
                                    </h4>
                                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-light)", fontWeight: 500 }}>
                                        {release.date}
                                    </span>
                                    {release.badge && (
                                        <span style={{
                                            fontSize: "0.625rem",
                                            fontWeight: 700,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                            padding: "0.125rem 0.375rem",
                                            borderRadius: "0.25rem",
                                            background: "rgba(37, 99, 235, 0.1)",
                                            color: "var(--color-security-blue)"
                                        }}>
                                            {release.badge}
                                        </span>
                                    )}
                                </div>

                                <div style={{ 
                                    display: "flex", 
                                    flexDirection: "column", 
                                    gap: "0.75rem",
                                    background: "var(--color-bg-surface, var(--color-white))",
                                    padding: "1.25rem",
                                    borderRadius: "var(--radius-xl)",
                                    border: "1px solid var(--color-border)",
                                    boxShadow: "var(--shadow-sm)"
                                }}>
                                    {release.updates.map((update, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                                            <div style={{ 
                                                marginTop: "0.125rem", 
                                                color: update.color,
                                                background: `${update.color}15`,
                                                padding: "0.25rem",
                                                borderRadius: "0.375rem"
                                            }}>
                                                <update.icon size={14} />
                                            </div>
                                            <p style={{ fontSize: "0.875rem", color: "var(--color-text-main)", margin: 0, lineHeight: 1.5 }}>
                                                {update.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
