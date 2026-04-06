import { useMemo, useState } from "react";
import { Clock3, History, X } from "lucide-react";
import type { VaultViewItem } from "../vault.types";
import { Button } from "../../../components/ui/Button";

interface VaultItemHistoryModalProps {
  itemTitle: string;
  versions: VaultViewItem[];
  loading: boolean;
  onClose: () => void;
}

export function VaultItemHistoryModal({
  itemTitle,
  versions,
  loading,
  onClose,
}: VaultItemHistoryModalProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const selectedVersion = useMemo(() => {
    if (!versions.length) return null;
    return versions.find((version) => version.id === selectedVersionId) ?? versions[0];
  }, [selectedVersionId, versions]);

  const selectedSecret = selectedVersion?.secret;

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-container" style={{ maxWidth: "56rem", width: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
            gap: "1rem",
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-main)", margin: 0 }}>
              Version History
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: "0.4rem 0 0 0" }}>
              {itemTitle || "Untitled"} has {versions.length} saved revision{versions.length !== 1 ? "s" : ""}.
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label="Close modal"
            style={{ position: "static", top: "auto", right: "auto" }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-subtle)" }}>
            Loading history…
          </div>
        ) : versions.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-subtle)" }}>
            No previous revisions yet. This item has not been updated since it was created.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1rem" }}>
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-xl)",
                background: "var(--color-soft-gray)",
                padding: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "26rem",
                overflowY: "auto",
              }}
            >
              {versions.map((version) => {
                const isSelected = version.id === selectedVersion?.id;
                const label = version.secret?.title || "Untitled";
                return (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => setSelectedVersionId(version.id)}
                    style={{
                      textAlign: "left",
                      border: "1px solid var(--color-border)",
                      background: isSelected ? "rgba(37, 99, 235, 0.08)" : "var(--color-white)",
                      borderRadius: "0.875rem",
                      padding: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-security-blue)" }}>
                      Version {version.version ?? "?"}
                    </div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-main)", marginTop: "0.25rem" }}>
                      {label}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-subtle)", marginTop: "0.35rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Clock3 size={12} />
                      {new Date(version.updatedAt).toLocaleString()}
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-xl)",
                padding: "1.25rem",
                background: "var(--color-white)",
                minHeight: "20rem",
              }}
            >
              {selectedVersion && selectedSecret ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-light)" }}>
                        Selected Revision
                      </div>
                      <h3 style={{ margin: "0.35rem 0 0 0", fontSize: "1.125rem", color: "var(--color-text-main)" }}>
                        {selectedSecret.title || "Untitled"}
                      </h3>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-security-blue)" }}>
                      <History size={14} />
                      Version {selectedVersion.version}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
                    <HistoryMeta label="Saved" value={new Date(selectedVersion.updatedAt).toLocaleString()} />
                    <HistoryMeta label="Type" value={selectedSecret.kind} />
                    <HistoryMeta label="Vault" value={selectedVersion.vaultName} />
                    <HistoryMeta label="Tags" value={selectedSecret.tags?.join(", ") || "None"} />
                  </div>

                  <div
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-xl)",
                      background: "var(--color-soft-gray)",
                      padding: "1rem",
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: "0.8125rem",
                        lineHeight: 1.6,
                        color: "var(--color-text-main)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {JSON.stringify(selectedSecret, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div style={{ color: "var(--color-text-subtle)" }}>This revision could not be decrypted.</div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function HistoryMeta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "0.875rem", padding: "0.875rem", background: "var(--color-bg-surface, var(--color-white))" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-light)" }}>
        {label}
      </div>
      <div style={{ fontSize: "0.875rem", color: "var(--color-text-main)", marginTop: "0.35rem" }}>
        {value}
      </div>
    </div>
  );
}
