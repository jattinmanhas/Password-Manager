import { useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { User, Mail, ShieldCheck, Check, X, Edit2 } from "lucide-react";
import { authService } from "../../auth/services/auth.service";

export function ProfileSection() {
    const { session, refreshSession } = useAuth();
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    if (!session) return null;

    const handleEditStart = () => {
        setNewName(session.name || "");
        setIsEditingName(true);
    };

    const handleEditCancel = () => {
        setIsEditingName(false);
        setNewName("");
    };

    const handleEditSave = async () => {
        if (!newName.trim() || newName === session.name) {
            handleEditCancel();
            return;
        }

        setIsLoading(true);
        try {
            await authService.updateProfile(newName);
            await refreshSession();
            setIsEditingName(false);
        } catch (error) {
            console.error("Failed to update profile", error);
        } finally {
            setIsLoading(false);
        }
    };

    const profileItems = [
        { 
            id: "name",
            label: "Display Name", 
            value: session.name || "Not set", 
            icon: User,
            editable: true
        },
        { id: "email", label: "Email Address", value: session.email, icon: Mail, editable: false },
        { id: "id", label: "Account ID", value: session.userId, icon: ShieldCheck, editable: false },
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
                        key={item.id}
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
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
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
                            
                            {item.id === "name" && isEditingName ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                                    <input 
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        disabled={isLoading}
                                        autoFocus
                                        style={{
                                            flex: 1,
                                            padding: "0.25rem 0.5rem",
                                            fontSize: "0.875rem",
                                            borderRadius: "0.375rem",
                                            border: "1px solid var(--color-border)",
                                            background: "var(--color-bg-surface)",
                                            color: "var(--color-text-main)",
                                            outline: "none",
                                            width: "100%",
                                            minWidth: "120px"
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleEditSave();
                                            if (e.key === "Escape") handleEditCancel();
                                        }}
                                    />
                                    <button 
                                        onClick={handleEditSave}
                                        disabled={isLoading}
                                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-security-blue)", padding: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >
                                        <Check size={16} />
                                    </button>
                                    <button 
                                        onClick={handleEditCancel}
                                        disabled={isLoading}
                                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--color-text-subtle)", padding: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                                    {item.editable && (
                                        <button 
                                            onClick={handleEditStart}
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                cursor: "pointer",
                                                color: "var(--color-text-subtle)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                padding: "0.25rem",
                                                borderRadius: "0.25rem",
                                                transition: "all 0.2s"
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-security-blue)"}
                                            onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-text-subtle)"}
                                            title="Edit Name"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                </div>
                            )}
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
