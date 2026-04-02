import { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, X, Check, Search, ShieldCheck, Mail, Loader2, Trash2, Clock, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "../../../app/providers/AuthProvider";
import { familyService } from "../services/family.service";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Dialog } from "../../../components/ui/Dialog";
import type { FamilyMember, FamilyRequest } from "../family.types";

export function Family() {
  const { session } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FamilyRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FamilyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Send Request State
  const [emailToInvite, setEmailToInvite] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [sendError, setSendError] = useState("");

  // Confirmation Modal State
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; userId: string; name: string }>({
    isOpen: false,
    userId: "",
    name: "",
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersResp, requestsResp] = await Promise.all([
        familyService.listMembers(),
        familyService.listRequests(),
      ]);
      setMembers(membersResp.members);
      setReceivedRequests(requestsResp.received);
      setSentRequests(requestsResp.sent);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load family data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailToInvite.trim().toLowerCase();
    if (!trimmed) return;

    if (trimmed === session?.email?.toLowerCase()) {
      setSendError("You cannot invite yourself");
      return;
    }

    setSendError("");
    setSendingRequest(true);
    try {
      await familyService.sendRequest(trimmed);
      toast.success(`Request sent to ${trimmed}`);
      setEmailToInvite("");
      await loadData();
    } catch (err: any) {
      setSendError(err?.message || "Failed to send request");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleAccept = async (userId: string, name: string) => {
    try {
      await familyService.acceptRequest(userId);
      toast.success(`${name ? name : "User"} added to family`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to accept request");
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await familyService.rejectRequest(userId);
      toast.success("Request rejected");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject request");
    }
  };
  
  const handleCancelSent = async (userId: string) => {
    try {
      await familyService.rejectRequest(userId);
      toast.success("Request canceled");
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel request");
    }
  };

  const handleRemoveMember = (userId: string, name: string) => {
    setConfirmDelete({ isOpen: true, userId, name });
  };

  const executeRemoveMember = async () => {
    const { userId } = confirmDelete;
    if (!userId) return;

    setIsDeleting(true);
    try {
      await familyService.removeMember(userId);
      toast.success("Family member removed");
      setConfirmDelete({ isOpen: false, userId: "", name: "" });
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove member");
    } finally {
      setIsDeleting(false);
    }
  };


  if (loading && members.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--color-security-blue)" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
        <div style={{
          width: "2.5rem", height: "2.5rem",
          background: "rgba(37,99,235,0.1)", borderRadius: "var(--radius-xl)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--color-security-blue)",
        }}>
          <Users size={20} />
        </div>
        <div>
           <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-main)", margin: 0 }}>
             Family Members
           </h1>
           <p style={{ color: "var(--color-text-subtle)", margin: 0, marginTop: "0.25rem", fontSize: "0.9375rem" }}>
             Manage the people you can securely share vault items with.
           </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        
        {/* Invite Section */}
        <section style={{ 
          background: "var(--color-white)", 
          border: "1px solid var(--color-border)", 
          borderRadius: "var(--radius-2xl)", 
          padding: "1.5rem" 
        }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--color-text-main)", margin: "0 0 1rem 0" }}>
            Add Family Member
          </h2>
          <form onSubmit={handleSendRequest} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Input
                type="email"
                placeholder="Friend or family member's email address"
                value={emailToInvite}
                onChange={(e) => {
                  setEmailToInvite(e.target.value);
                  setSendError("");
                }}
                disabled={sendingRequest}
                style={{ height: "3rem", width: "100%" }}
              />
              {sendError && (
                <span style={{ fontSize: "0.8125rem", color: "#ef4444", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <AlertCircle size={14} /> {sendError}
                </span>
              )}
            </div>
            <Button type="submit" disabled={sendingRequest || !emailToInvite.trim()} style={{ height: "3rem", padding: "0 1.5rem", flexShrink: 0 }}>
              {sendingRequest ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <UserPlus size={18} style={{ marginRight: "0.5rem" }}/>}
              Send Request
            </Button>
          </form>
        </section>

        {/* Pending Received Requests */}
        {receivedRequests.length > 0 && (
          <section>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-main)", margin: "0 0 1rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Mail size={18} style={{ color: "var(--color-security-blue)" }} /> Pending Invitations
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {receivedRequests.map(req => (
                <div key={req.user_id} style={{
                  background: "var(--color-white)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)",
                  padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                     <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", background: "var(--color-soft-gray)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-subtle)", fontWeight: 600 }}>
                        {req.name ? req.name.substring(0,2).toUpperCase() : req.email.substring(0,2).toUpperCase()}
                     </div>
                     <div>
                       <div style={{ fontWeight: 600, color: "var(--color-text-main)", fontSize: "0.9375rem" }}>{req.name || req.email}</div>
                       {req.name && <div style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)" }}>{req.email}</div>}
                     </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => void handleReject(req.user_id)} 
                      style={{ width: "auto", transition: "all 0.15s" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--color-red)";
                        e.currentTarget.style.borderColor = "var(--color-red)";
                        e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "";
                        e.currentTarget.style.borderColor = "";
                        e.currentTarget.style.background = "";
                      }}
                    >
                       <X size={16} style={{ marginRight: "0.25rem" }}/> Decline
                    </Button>
                    <Button size="sm" onClick={() => void handleAccept(req.user_id, req.name || req.email)} style={{ width: "auto" }}>
                       <Check size={16} style={{ marginRight: "0.25rem" }}/> Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Existing Members */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--color-text-main)", margin: 0 }}>
              Your Family
            </h2>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)", background: "var(--color-white)", border: "1px solid var(--color-border)", padding: "0.25rem 0.75rem", borderRadius: "99px", fontWeight: 500 }}>
              {members.length} {members.length === 1 ? 'Member' : 'Members'}
            </span>
          </div>
          
          {members.length === 0 ? (
            <div style={{ background: "var(--color-white)", border: "1px dashed var(--color-border)", borderRadius: "var(--radius-2xl)", padding: "3rem 1.5rem", textAlign: "center" }}>
               <Users size={32} style={{ color: "var(--color-text-light)", margin: "0 auto 1rem auto" }} />
               <p style={{ color: "var(--color-text-subtle)", margin: 0 }}>You don't have any family members yet.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
              {members.map(member => (
                <div key={member.user_id} style={{
                  background: "var(--color-white)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)",
                  padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem", position: "relative",
                  boxShadow: "0 2px 4px -1px rgba(0,0,0,0.02)"
                }}>
                   <div style={{ width: "2.75rem", height: "2.75rem", borderRadius: "50%", background: "rgba(5, 150, 105, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669", fontWeight: 600 }}>
                       {member.name ? member.name.substring(0,2).toUpperCase() : member.email.substring(0,2).toUpperCase()}
                   </div>
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div style={{ fontWeight: 600, color: "var(--color-text-main)", fontSize: "0.9375rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                       {member.name || member.email}
                     </div>
                     {member.name && (
                       <div style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                         {member.email}
                       </div>
                     )}
                   </div>
                   
                   <button 
                     onClick={() => void handleRemoveMember(member.user_id, member.name || member.email)}
                     style={{ 
                       background: "none", border: "none", cursor: "pointer", 
                       padding: "0.5rem", borderRadius: "0.5rem", color: "var(--color-text-light)",
                       transition: "all 0.15s"
                     }}
                     title="Remove member"
                     onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-red)"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                     onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-light)"; e.currentTarget.style.background = "transparent"; }}
                   >
                     <Trash2 size={16} />
                   </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending Sent Requests */}
        {sentRequests.length > 0 && (
          <section style={{ marginTop: "1rem" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text-subtle)", margin: "0 0 1rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={16} /> Sent Requests
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {sentRequests.map(req => (
                <div key={req.user_id} style={{
                  background: "var(--color-soft-gray)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
                  padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between"
                }}>
                  <div style={{ fontSize: "0.875rem", color: "var(--color-text-main)" }}>
                    Waiting for <strong>{req.email}</strong> to accept
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => void handleCancelSent(req.user_id)} 
                    style={{ padding: "0.25rem 0.5rem", height: "auto", fontSize: "0.75rem", flexShrink: 0, width: "auto", transition: "all 0.15s" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--color-red)";
                      e.currentTarget.style.borderColor = "var(--color-red)";
                      e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "";
                      e.currentTarget.style.borderColor = "";
                      e.currentTarget.style.background = "";
                    }}
                  >
                     Cancel
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      <Dialog
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ ...confirmDelete, isOpen: false })}
        title="Remove Family Member"
        description={`Are you sure you want to remove ${confirmDelete.name || "this user"} from your family? They will no longer be able to share items with you.`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={() => void executeRemoveMember()}
        type="confirm"
        isLoading={isDeleting}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
