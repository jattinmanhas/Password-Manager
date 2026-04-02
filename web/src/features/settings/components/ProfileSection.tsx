import { useAuth } from "../../../app/providers/AuthProvider";
import { User, Mail, Calendar, ShieldCheck } from "lucide-react";

export function ProfileSection() {
    const { session } = useAuth();

    if (!session) return null;

    const profileItems = [
        { label: "Display Name", value: session.name || "Not set", icon: User },
        { label: "Email Address", value: session.email, icon: Mail },
        { label: "Account ID", value: session.userId, icon: ShieldCheck },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div style={{ padding: "0 0.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-main)", marginBottom: "0.5rem" }}>
                    Profile
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: 0 }}>
                    Manage your personal information and how it appears to others.
                </p>
            </div>

            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", 
                gap: "1rem" 
            }}>
                {profileItems.map((item) => (
                    <div 
                        key={item.label}
                        style={{
                            padding: "1.25rem",
                            borderRadius: "var(--radius-xl)",
                            background: "var(--color-bg-surface, var(--color-white))",
                            border: "1px solid var(--color-border)",
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                            boxShadow: "var(--shadow-sm)"
                        }}
                    >
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
                            <item.icon size={20} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ 
                                fontSize: "0.75rem", 
                                fontWeight: 600, 
                                textTransform: "uppercase", 
                                letterSpacing: "0.05em",
                                color: "var(--color-text-light)",
                                marginBottom: "0.125rem"
                            }}>
                                {item.label}
                            </p>
                            <p style={{ 
                                fontSize: "0.9375rem", 
                                fontWeight: 500, 
                                color: "var(--color-text-main)",
                                margin: 0,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}>
                                {item.value}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{
                padding: "1.5rem",
                borderRadius: "var(--radius-xl)",
                background: "rgba(37, 99, 235, 0.03)",
                border: "1px dashed var(--color-security-blue)",
                textAlign: "center"
            }}>
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: 0 }}>
                    Looking to change your password or email? 
                    <span style={{ color: "var(--color-security-blue)", fontWeight: 600, marginLeft: "0.5rem", cursor: "pointer" }}>
                        Contact Support
                    </span>
                </p>
            </div>
        </div>
    );
}
