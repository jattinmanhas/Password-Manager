import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { 
    LayoutDashboard, Key, Users, ShieldCheck, Activity, Settings, 
    LogOut, Menu, X, ChevronLeft, ChevronRight, User as UserIcon
} from "lucide-react";
import { useAuth } from "../../app/providers/AuthProvider";

export function DashboardLayout() {
    const { logout, session } = useAuth();
    const location = useLocation();
    
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileOpen(false);
    }, [location.pathname]);

    const mainNav = [
        { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { name: "Vault", path: "/vault", icon: Key },
        { name: "Shared Vaults", path: "/shared", icon: Users },
        { name: "Security Health", path: "/health", icon: ShieldCheck },
        { name: "Activity", path: "/activity", icon: Activity },
    ];

    const secondaryNav = [
        { name: "Family Members", path: "/family", icon: Users }, // you can use a different icon if available
        { name: "Two-Factor Auth", path: "/setup-2fa", icon: ShieldCheck },
        { name: "Settings", path: "/settings", icon: Settings },
    ];

    const isActive = (path: string) => {
        if (path === "/dashboard" && location.pathname === "/dashboard") return true;
        if (path !== "/dashboard" && location.pathname.startsWith(path)) return true;
        return false;
    };

    const NavItem = ({ item }: { item: { name: string, path: string, icon: any } }) => {
        const active = isActive(item.path);
        return (
            <Link
                to={item.path}
                title={isCollapsed ? item.name : undefined}
                style={{
                    display: "flex",
                    alignItems: "center",
                    position: "relative",
                    gap: "0.75rem",
                    padding: isCollapsed ? "0.75rem" : "0.75rem 1rem",
                    justifyContent: isCollapsed ? "center" : "flex-start",
                    borderRadius: "0.75rem",
                    textDecoration: "none",
                    transition: "all 0.15s ease-in-out",
                    color: active ? "var(--color-security-blue)" : "var(--color-text-main)",
                    backgroundColor: active ? "rgba(37, 99, 235, 0.08)" : "transparent",
                    fontWeight: active ? 600 : 500,
                    margin: "0.125rem 0",
                }}
                onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "rgba(37, 99, 235, 0.04)";
                }}
                onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "transparent";
                }}
            >
                {/* Active Indicator Bar */}
                {active && !isCollapsed && (
                    <div style={{
                        position: "absolute",
                        left: "-1rem",
                        width: "4px",
                        height: "1.5rem",
                        backgroundColor: "var(--color-security-blue)",
                        borderTopRightRadius: "4px",
                        borderBottomRightRadius: "4px"
                    }} />
                )}
                
                <item.icon size={20} style={{ 
                    color: active ? "var(--color-security-blue)" : "var(--color-text-subtle)",
                    flexShrink: 0 
                }} />
                
                {!isCollapsed && <span style={{ whiteSpace: "nowrap" }}>{item.name}</span>}
            </Link>
        );
    };

    return (
        <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--color-soft-gray)" }}>
            
            {/* Mobile Header */}
            <header className="mobile-header" style={{
                display: "none", // Will be overridden in media query logic below if we were using purely CSS, but we use inline styles here so let's handle mobile header via window width or standard CSS classes if possible. 
                // Since this needs to be robust, we'll render a fixed header that shows only on small screens.
            }}>
                {/* For simplicity without a full CSS file update, we will handle responsive layout structure */}
            </header>

            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div 
                    onClick={() => setIsMobileOpen(false)}
                    style={{
                        position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 40
                    }} 
                />
            )}

            {/* Sidebar */}
            <aside 
                style={{
                    position: "fixed",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    zIndex: 50,
                    width: isCollapsed ? "5rem" : "16rem",
                    backgroundColor: "var(--color-white)",
                    borderRight: "1px solid var(--color-border)",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    transition: "width 0.2s ease-in-out, transform 0.2s ease-in-out",
                    transform: `translateX(${typeof window !== 'undefined' && window.innerWidth < 768 && !isMobileOpen ? '-100%' : '0'})`,
                }}
            >
                {/* Logo Area */}
                <div style={{ padding: isCollapsed ? "1.5rem 0" : "1.5rem", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "1.25rem", fontWeight: "bold", justifyContent: isCollapsed ? "center" : "flex-start" }}>
                        <div style={{
                            width: "2.5rem", height: "2.5rem", flexShrink: 0,
                            backgroundColor: "var(--color-security-blue)",
                            borderRadius: "0.75rem",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "white", boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)"
                        }}>
                            <ShieldCheck size={20} />
                        </div>
                        {!isCollapsed && <span style={{ color: "var(--color-text-main)" }}>Family Vault</span>}
                    </div>
                </div>

                {/* Navigation */}
                <nav style={{ flex: 1, padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1rem", overflowY: "auto", overflowX: "hidden" }}>
                    
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {mainNav.map(item => <NavItem key={item.path} item={item} />)}
                    </div>

                    <div style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "0.5rem 0" }} />

                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {secondaryNav.map(item => <NavItem key={item.path} item={item} />)}
                    </div>
                </nav>

                {/* User Area & Footer */}
                <div style={{ borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}>
                    
                    {/* User Info & Sign Out */}
                    <div style={{ 
                        padding: isCollapsed ? "1rem 0" : "1rem", 
                        display: "flex", 
                        flexDirection: isCollapsed ? "column" : "row",
                        alignItems: "center", 
                        justifyContent: "center", 
                        gap: "0.75rem" 
                    }}>
                        <div style={{
                            width: "2.5rem", height: "2.5rem", flexShrink: 0,
                            backgroundColor: "var(--color-border)", borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-subtle)",
                            margin: isCollapsed ? "0 auto" : 0
                        }}>
                            <UserIcon size={20} />
                        </div>
                        
                        {!isCollapsed && (
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontWeight: 600, fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--color-text-main)", margin: 0 }}>
                                    {session?.name || "User"}
                                </p>
                                <p style={{ color: "var(--color-text-subtle)", fontSize: "0.75rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>
                                    {session?.email}
                                </p>
                            </div>
                        )}

                        <button 
                            onClick={logout} 
                            title="Sign Out"
                            style={{ 
                                display: "flex", alignItems: "center", justifyContent: "center", 
                                color: "var(--color-text-subtle)", 
                                padding: "0.5rem", 
                                borderRadius: "0.5rem",
                                transition: "all 0.15s",
                                backgroundColor: "transparent",
                                border: "none",
                                cursor: "pointer",
                                marginTop: isCollapsed ? "0.25rem" : 0
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.08)";
                                e.currentTarget.style.color = "#ef4444";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                                e.currentTarget.style.color = "var(--color-text-subtle)";
                            }}
                        >
                            <LogOut size={18} />
                        </button>
                    </div>

                    {/* Desktop Collapse Toggle - Floating on border */}
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        style={{ 
                            position: "absolute",
                            top: "5.5rem",
                            right: "-12px",
                            width: "24px",
                            height: "24px",
                            backgroundColor: "var(--color-white)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "50%",
                            display: typeof window !== 'undefined' && window.innerWidth >= 768 ? "flex" : "none",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--color-security-blue)",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            cursor: "pointer",
                            zIndex: 60,
                            transition: "transform 0.2s ease-in-out"
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "var(--color-security-blue)";
                            e.currentTarget.style.color = "white";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "white";
                            e.currentTarget.style.color = "var(--color-security-blue)";
                        }}
                    >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div style={{ 
                flex: 1, 
                display: "flex", 
                flexDirection: "column",
                marginLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? (isCollapsed ? "5rem" : "16rem") : "0",
                transition: "margin-left 0.2s ease-in-out"
            }}>
                {/* Mobile Top Bar */}
                <div style={{
                    display: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'none' : 'flex',
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    backgroundColor: "var(--color-white)",
                    borderBottom: "1px solid var(--color-border)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "bold", fontSize: "1.125rem", color: "var(--color-text-main)" }}>
                        <ShieldCheck size={20} className="text-blue" />
                        Family Vault
                    </div>
                    <button 
                        onClick={() => setIsMobileOpen(true)} 
                        style={{ 
                            color: "var(--color-security-blue)", 
                            padding: "0.5rem",
                            borderRadius: "0.5rem",
                            backgroundColor: "rgba(37, 99, 235, 0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "none",
                            cursor: "pointer"
                        }}
                    >
                        <Menu size={24} />
                    </button>
                </div>

                <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
