import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Key,
  FileKey,
  Share2,
  UserMinus,
  UserPlus,
  Trash2,
  Shield,
  UserX,
  History,
  Calendar,
  Trash,
  AlertTriangle,
  Loader2,
  LogOut,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Info,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";

import {
  auditService,
  AuditEvent,
  AuditFilter,
} from "../services/audit.service";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";

// Helper to format timestamps
const formatTimeOnly = (isoString: string) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const formatDateHeader = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

type EventImportance = "success" | "warning" | "critical" | "info";

const getEventDetails = (event: AuditEvent) => {
  const type = event.event_type;
  const data = event.event_data || {};

  const mapping: Record<
    string,
    {
      icon: any;
      importance: EventImportance;
      label: string;
      title: string;
      text: string;
    }
  > = {
    auth_login_success: {
      icon: <ShieldCheck size={18} />,
      importance: "success",
      label: "Authentication",
      title: "Successful Login",
      text: `Access granted via ${data.device_name || "recognized device"}`,
    },
    auth_login_failed: {
      icon: <ShieldAlert size={18} />,
      importance: "critical",
      label: "Security Alert",
      title: "Failed Login Attempt",
      text: `Unauthorized attempt: ${data.reason || "Invalid credentials"}`,
    },
    auth_logout: {
      icon: <LogOut size={18} />,
      importance: "info",
      label: "Authentication",
      title: "Logged Out",
      text: "Session terminated successfully",
    },
    vault_item_created: {
      icon: <Key size={18} />,
      importance: "info",
      label: "Vault Action",
      title: "Item Created",
      text: `A new entry was added to your secure vault`,
    },
    vault_item_updated: {
      icon: <CheckCircle size={18} />,
      importance: "success",
      label: "Vault Action",
      title: "Item Modified",
      text: `Existing vault entry details were updated`,
    },
    vault_item_deleted: {
      icon: <Trash2 size={18} />,
      importance: "critical",
      label: "Vault Action",
      title: "Item Removed",
      text: `A vault entry was permanently deleted`,
    },
    sharing_item_shared: {
      icon: <Share2 size={18} />,
      importance: "success",
      label: "Sharing",
      title: "Access Shared",
      text: `Granted '${data.permissions || "read"}' access to a member`,
    },
    sharing_revoked: {
      icon: <UserMinus size={18} />,
      importance: "critical",
      label: "Sharing",
      title: "Access Revoked",
      text: `Terminated shared access for a vault item`,
    },
    family_invite_sent: {
      icon: <UserPlus size={18} />,
      importance: "info",
      label: "Family Group",
      title: "Invite Sent",
      text: `Invitation sent to ${data.friend_email || "new member"}`,
    },
    family_invite_accepted: {
      icon: <Shield size={18} />,
      importance: "success",
      label: "Family Group",
      title: "Member Joined",
      text: `A new member has joined your family circle`,
    },
    family_member_removed: {
      icon: <UserX size={18} />,
      importance: "critical",
      label: "Family Group",
      title: "Member Removed",
      text: `Revoked family membership for a user`,
    },
  };

  return (
    mapping[type] || {
      icon: <History size={18} />,
      importance: "info",
      label: "System",
      title: type
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      text: `System event: ${type}`,
    }
  );
};

const importanceStyles: Record<
  EventImportance,
  { color: string; bg: string; border: string }
> = {
  success: {
    color: "var(--color-emerald)",
    bg: "var(--color-emerald-subtle)",
    border: "rgba(16, 185, 129, 0.2)",
  },
  warning: {
    color: "var(--color-amber)",
    bg: "var(--color-amber-subtle)",
    border: "rgba(245, 158, 11, 0.2)",
  },
  critical: {
    color: "var(--color-rose)",
    bg: "var(--color-rose-subtle)",
    border: "rgba(244, 63, 94, 0.2)",
  },
  info: {
    color: "var(--color-blue)",
    bg: "var(--color-blue-subtle)",
    border: "rgba(59, 130, 246, 0.2)",
  },
};

export const Activity = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<"secure" | "warning" | "unknown">(
    "unknown",
  );
  const [hasNext, setHasNext] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const limit = 25;

  const observer = useRef<IntersectionObserver | null>(null);
  const lastEventElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading || loadingMore) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasNext) {
            setOffset((prev) => prev + limit);
          }
        },
        { rootMargin: "100px" },
      );

      if (node) observer.current.observe(node);
    },
    [loading, loadingMore, hasNext],
  );

  const fetchStatus = async () => {
    try {
      const res = await auditService.getSummary();
      setStatus(res.status as "secure" | "warning");
    } catch (err) {
      setStatus("unknown");
    }
  };

  const loadEvents = async (
    currentOffset: number,
    isInitial = false,
    currentFilter?: AuditFilter,
  ) => {
    try {
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const res = await auditService.getLogs(
        limit,
        currentOffset,
        currentFilter,
      );

      setEvents((prev) => (isInitial ? res.events : [...prev, ...res.events]));
      setHasNext(res.has_next);
    } catch (err: any) {
      toast.error("Failed to sync security ledger");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadEvents(0, true, { query: searchQuery, category });
    fetchStatus();
  }, [searchQuery, category]);

  useEffect(() => {
    if (offset > 0) {
      loadEvents(offset, false, { query: searchQuery, category });
    }
  }, [offset]);

  const handleClearLogs = async () => {
    if (
      !confirm(
        "Clear Security Ledger? This action is permanent and cannot be undone.",
      )
    )
      return;

    try {
      setLoading(true);
      await auditService.clearLogs();
      setEvents([]);
      setHasNext(false);
      setOffset(0);
      toast.success("Security Ledger purged");
      fetchStatus();
    } catch (err: any) {
      toast.error("Failed to clear ledger");
      setLoading(false);
    }
  };

  const groupedEvents = useMemo(() => {
    const groups: { [date: string]: AuditEvent[] } = {};
    events.forEach((event) => {
      const dateKey = new Date(event.created_at).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    });
    return groups;
  }, [events]);

  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "2.5rem",
              height: "2.5rem",
              background: "rgba(37,99,235,0.1)",
              borderRadius: "var(--radius-xl)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-security-blue)",
              flexShrink: 0,
            }}
          >
            <History size={20} />
          </div>
          <div>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "var(--color-text-main)",
                margin: 0,
              }}
            >
              Security Ledger
            </h1>
            <p
              style={{
                color: "var(--color-text-subtle)",
                margin: 0,
                marginTop: "0.25rem",
                fontSize: "0.9375rem",
              }}
            >
              A tamper-evident record of cryptographic and administrative actions.
            </p>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexShrink: 0,
            alignItems: "center",
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOffset(0);
              loadEvents(0, true, { query: searchQuery, category });
              fetchStatus();
            }}
            style={{
              height: "2.25rem",
              padding: "0 0.75rem",
              fontSize: "0.8125rem",
              borderRadius: "var(--radius-xl)",
              whiteSpace: "nowrap",
            }}
          >
            <RefreshCw
              size={14}
              style={{ marginRight: "0.375rem" }}
              className={loading && offset === 0 ? "animate-spin" : ""}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearLogs}
            style={{
              height: "2.25rem",
              padding: "0 0.75rem",
              fontSize: "0.8125rem",
              borderRadius: "var(--radius-xl)",
              color: "var(--color-red)",
              borderColor: "var(--color-border)",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.05)";
              e.currentTarget.style.borderColor = "var(--color-red)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
          >
            <Trash2 size={14} style={{ marginRight: "0.375rem" }} />
            Purge History
          </Button>
        </div>
      </div>

      {/* Security Status Section */}
      <section
        style={{
          background:
            status === "secure"
              ? "rgba(16, 185, 129, 0.03)"
              : status === "warning"
                ? "rgba(245, 158, 11, 0.03)"
                : "var(--color-white)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-2xl)",
          padding: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
        }}
      >
        <div
          style={{
            width: "3rem",
            height: "3rem",
            borderRadius: "var(--radius-xl)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            backgroundColor:
              status === "secure"
                ? "var(--color-emerald-subtle)"
                : status === "warning"
                  ? "var(--color-amber-subtle)"
                  : "var(--color-bg-elevated)",
            border:
              status === "secure"
                ? "1px solid rgba(16, 185, 129, 0.2)"
                : status === "warning"
                  ? "1px solid rgba(245, 158, 11, 0.2)"
                  : "1px solid var(--color-border)",
          }}
        >
          {status === "secure" ? (
            <ShieldCheck style={{ color: "var(--color-emerald)" }} size={22} />
          ) : status === "warning" ? (
            <ShieldAlert style={{ color: "var(--color-amber)" }} size={22} />
          ) : (
            <Shield style={{ color: "var(--color-text-subtle)" }} size={22} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: "1.125rem",
              color: "var(--color-text-main)",
            }}
          >
            {status === "secure"
              ? "System Status: Secure"
              : status === "warning"
                ? "Security Notice Needed"
                : "Checking Health..."}
          </h3>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.875rem",
              color: "var(--color-text-subtle)",
            }}
          >
            {status === "secure"
              ? "No suspicious activity detected in the last 24 hours."
              : status === "warning"
                ? "Potential suspicious activity recorded recently. Please review the logs."
                : "Analyzing audit trails for anomalies..."}
          </p>
        </div>
        <div
          style={{
            padding: "0.25rem 0.75rem",
            borderRadius: "99px",
            fontSize: "0.75rem",
            fontWeight: 600,
            backgroundColor:
              status === "secure"
                ? "var(--color-emerald-subtle)"
                : status === "warning"
                  ? "var(--color-amber-subtle)"
                  : "rgba(0,0,0,0.05)",
            color:
              status === "secure"
                ? "var(--color-emerald)"
                : status === "warning"
                  ? "var(--color-amber)"
                  : "var(--color-text-subtle)",
            border: "1px solid currentColor",
            opacity: 0.8,
          }}
        >
          {status === "secure"
            ? "Healthy"
            : status === "warning"
              ? "Audit Alert"
              : "Pending"}
        </div>
      </section>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--color-text-light)",
            }}
          />
          <input
            type="text"
            placeholder="Search ledger..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              height: "2.75rem",
              padding: "0 1rem 0 2.5rem",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--color-border)",
              backgroundColor: "var(--color-white)",
              fontSize: "0.875rem",
              outline: "none",
              transition: "border-color 0.15s ease-in-out",
            }}
          />
        </div>
        <div style={{ width: "200px" }}>
          <Select
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: "All Categories" },
              { value: "auth", label: "Authentication" },
              { value: "vault", label: "Vault Actions" },
              { value: "sharing", label: "Sharing" },
              { value: "family", label: "Family Group" },
            ]}
            placeholder="All Categories"
          />
        </div>
      </div>

      {/* Ledger Content */}
      {loading && offset === 0 ? (
        <div
          style={{
            padding: "4rem 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <Loader2
            size={28}
            style={{
              animation: "spin 1s linear infinite",
              color: "var(--color-security-blue)",
            }}
          />
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-subtle)",
              fontWeight: 500,
            }}
          >
            Syncing ledger...
          </p>
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            padding: "4rem 2rem",
            textAlign: "center",
            borderRadius: "var(--radius-2xl)",
            border: "1px dashed var(--color-border)",
            backgroundColor: "var(--color-white)",
          }}
        >
          <div
            style={{
              width: "3rem",
              height: "3rem",
              borderRadius: "50%",
              background: "var(--color-soft-gray)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-light)",
              margin: "0 auto 1.25rem",
            }}
          >
            <History size={24} />
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--color-text-main)",
            }}
          >
            Clean Ledger
          </h3>
          <p
            style={{
              color: "var(--color-text-subtle)",
              maxWidth: "18rem",
              margin: "0.5rem auto 0",
              fontSize: "0.875rem",
            }}
          >
            {searchQuery || category
              ? "No logs match your current filters."
              : "No security events have been recorded yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {Object.keys(groupedEvents).map((dateKey) => (
            <div
              key={dateKey}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--color-text-subtle)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  paddingLeft: "0.5rem",
                }}
              >
                {formatDateHeader(dateKey)}
              </div>

              <div
                style={{
                  backgroundColor: "var(--color-white)",
                  borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--color-border)",
                  overflow: "hidden",
                  boxShadow: "0 2px 4px -1px rgba(0,0,0,0.02)",
                }}
              >
                {groupedEvents[dateKey].map((event, idx) => {
                  const details = getEventDetails(event);
                  const style = importanceStyles[details.importance];
                  const isLast = idx === groupedEvents[dateKey].length - 1;
                  const isLastGlobal =
                    event.id === events[events.length - 1].id;

                  return (
                    <div
                      key={event.id}
                      ref={isLastGlobal ? lastEventElementRef : null}
                      style={{
                        padding: "1rem 1.25rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        borderBottom: isLast
                          ? "none"
                          : "1px solid var(--color-border)",
                        transition: "background-color 0.15s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "rgba(0,0,0,0.015)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <div
                        style={{
                          width: "2.5rem",
                          height: "2.5rem",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          backgroundColor: style.bg,
                          color: style.color,
                        }}
                      >
                        {details.icon}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <h4
                            style={{
                              margin: 0,
                              fontSize: "0.9375rem",
                              fontWeight: 600,
                              color: "var(--color-text-main)",
                            }}
                          >
                            {details.title}
                          </h4>
                          <span
                            style={{
                              fontSize: "0.625rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "0.125rem 0.375rem",
                              borderRadius: "4px",
                              backgroundColor: "var(--color-soft-gray)",
                              color: "var(--color-text-subtle)",
                            }}
                          >
                            {details.label}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.8125rem",
                            color: "var(--color-text-subtle)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {details.text}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: "0.125rem",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "var(--color-text-main)",
                            opacity: 0.7,
                          }}
                        >
                          {formatTimeOnly(event.created_at)}
                        </div>
                        {details.importance !== "info" && (
                          <div
                            style={{
                              fontSize: "0.625rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              color: style.color,
                              opacity: 0.8,
                            }}
                          >
                            {details.importance}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {loadingMore && (
            <div
              style={{
                padding: "2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
              }}
            >
              <Loader2
                size={20}
                style={{
                  animation: "spin 1s linear infinite",
                  color: "var(--color-text-light)",
                }}
              />
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--color-text-light)",
                }}
              >
                Syncing more entries...
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `}</style>
    </div>
  );
};
