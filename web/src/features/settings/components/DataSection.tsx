import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Upload, Download, FileText, AlertTriangle, CheckCircle, Loader } from "lucide-react";
import { useVaultSession } from "../../../app/providers/VaultProvider";
import { encryptVaultItem } from "../../../crypto";
import { vaultService } from "../../vault/services/vault.service";
import {
  parseImportCSV,
  serializeCSV,
  EXPORT_HEADERS,
  createExportRow,
  downloadCSV,
  SAMPLE_GENERIC_CSV,
  type ImportKind,
} from "../../../lib/csv";
import type { VaultViewItem } from "../../vault/vault.types";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";

// ─── Export ───────────────────────────────────────────────────────────────────

function ExportCard() {
  const { items } = useVaultSession();
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    try {
      const exportable = items.filter((i) => !i.isCorrupted && i.secret && i.vaultType !== "shared");

      if (exportable.length === 0) {
        toast.error("No exportable items found in your vault.");
        return;
      }

      const rows = exportable.map((item: VaultViewItem) => createExportRow(item.secret!));

      const csv = serializeCSV(Array.from(EXPORT_HEADERS), rows);
      const date = new Date().toISOString().slice(0, 10);
      downloadCSV(`vault-export-${date}.csv`, csv);
      toast.success(`Exported ${rows.length} vault items`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="settings-card-tight" style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div style={iconContainerStyle("var(--color-security-blue)")}>
          <Download size={20} color="white" />
        </div>
        <div>
          <h3 style={cardTitleStyle}>Export Vault</h3>
          <p style={cardDescStyle}>Download all your vault items as a CSV file for backup.</p>
        </div>
      </div>

      <div style={warningBoxStyle}>
        <AlertTriangle size={15} style={{ flexShrink: 0, color: "#D97706" }} />
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "#92400E" }}>
          <strong>Sensitive data.</strong> The exported CSV will contain plain-text passwords. Store it securely and delete it when done.
        </p>
      </div>

      <div className="flex-responsive" style={footerStyle}>
        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)" }}>
          {items.filter((i) => !i.isCorrupted && i.vaultType !== "shared").length} items ready for export
        </span>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
          <span style={{ marginLeft: "0.375rem" }}>Export CSV</span>
        </Button>
      </div>
    </div>
  );
}

// ─── Import ───────────────────────────────────────────────────────────────────

type ImportStatus = "idle" | "parsing" | "encrypting" | "uploading" | "done" | "error";

function ImportCard() {
  const { kek, aead, isKekVerified } = useVaultSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ImportKind>("generic");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleDownloadSample = () => {
    downloadCSV("vault-import-sample.csv", SAMPLE_GENERIC_CSV);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Please select a CSV file first.");
      return;
    }
    if (!kek || !aead || !isKekVerified) {
      toast.error("Vault is locked. Please unlock your vault before importing.");
      return;
    }

    setStatus("parsing");
    setErrorMsg("");

    try {
      const text = await selectedFile.text();
      const parsed = parseImportCSV(text, format);

      if (parsed.length === 0) {
        setStatus("error");
        setErrorMsg("No valid items found in the CSV file. Please check the format.");
        return;
      }

      // ── Encrypt all items locally ──────────────────────────────────────────
      setStatus("encrypting");
      setProgress({ done: 0, total: parsed.length });

      const encryptedItems: {
        folder_id?: string | undefined;
        ciphertext: string;
        nonce: string;
        wrapped_dek: string;
        wrap_nonce: string;
        algo_version: string;
        metadata?: any;
      }[] = [];

      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        const plaintext = JSON.stringify(item);

        const payload = encryptVaultItem({ plaintext, kek, aead });
        encryptedItems.push({
          ciphertext: payload.ciphertext,
          nonce: payload.nonce,
          wrapped_dek: payload.wrappedDek,
          wrap_nonce: payload.wrapNonce,
          algo_version: payload.version,
          metadata: { kind: item.kind },
        });

        if (i % 50 === 49 || i === parsed.length - 1) {
          setProgress({ done: i + 1, total: parsed.length });
          // Yield to UI between chunks
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      // ── Send in batches of 500 (backend max) ───────────────────────────────
      setStatus("uploading");
      const BATCH_SIZE = 500;
      for (let start = 0; start < encryptedItems.length; start += BATCH_SIZE) {
        const batch = encryptedItems.slice(start, start + BATCH_SIZE);
        await vaultService.bulkCreateItems({ items: batch as any });
        setProgress({ done: Math.min(start + BATCH_SIZE, encryptedItems.length), total: encryptedItems.length });
      }

      setStatus("done");
      toast.success(`Successfully imported ${parsed.length} items into your vault!`);
      // Reset file selection
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Import failed. Please check the file and try again.");
      toast.error("Import failed");
    }
  };

  const isLocked = !kek || !aead || !isKekVerified;

  return (
    <div className="settings-card-tight" style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div style={iconContainerStyle("#7C3AED")}>
          <Upload size={20} color="white" />
        </div>
        <div>
          <h3 style={cardTitleStyle}>Import Data</h3>
          <p style={cardDescStyle}>Import passwords from another password manager using CSV.</p>
        </div>
      </div>

      {isLocked && (
        <div style={{ ...warningBoxStyle, background: "rgba(239,68,68,0.07)", borderColor: "rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, color: "#DC2626" }} />
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-main)" }}>
            Your vault must be <strong>unlocked</strong> before you can import items.
          </p>
        </div>
      )}

      {/* Format selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Source Format</label>
          <Select
            value={format}
            onChange={(value) => { 
                setStatus("idle"); 
                setFormat(value as ImportKind); 
                setSelectedFile(null);
                if (fileRef.current) fileRef.current.value = "";
            }}
            options={[
              { value: "generic", label: "PMV2 / Generic CSV (recommended)" },
              { value: "bitwarden", label: "Bitwarden CSV" },
            ]}
          />
        </div>

        {/* Sample download hint */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.75rem 1rem",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-soft-gray)",
          border: "1px solid var(--color-border)",
        }}>
          <FileText size={15} color="var(--color-text-subtle)" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-subtle)", flex: 1 }}>
            Not sure about the format?{" "}
            <button
              onClick={handleDownloadSample}
              style={{ background: "none", border: "none", color: "var(--color-security-blue)", cursor: "pointer", fontWeight: 600, padding: 0, fontSize: "0.8125rem" }}
            >
              Download sample CSV template
            </button>
          </p>
        </div>

        {/* File input */}
        <div>
          <label style={labelStyle}>CSV File</label>
          <div
            onClick={() => !isLocked && fileRef.current?.click()}
            style={{
              padding: "1.5rem",
              borderRadius: "var(--radius-xl)",
              border: "2px dashed var(--color-border)",
              background: "var(--color-soft-gray)",
              cursor: isLocked ? "not-allowed" : "pointer",
              textAlign: "center",
              transition: "border-color 0.15s ease",
              opacity: isLocked ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!isLocked) e.currentTarget.style.borderColor = "var(--color-security-blue)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
          >
            {selectedFile ? (
                <>
                    <div style={{
                        width: "3rem", height: "3rem", borderRadius: "1rem", 
                        background: "rgba(16, 185, 129, 0.1)", color: "#10B981",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 0.75rem"
                    }}>
                        <FileText size={28} />
                    </div>
                    <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-text-main)" }}>
                        {selectedFile.name}
                    </p>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--color-text-subtle)" }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB • Ready to import
                    </p>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            if (fileRef.current) fileRef.current.value = "";
                        }}
                        style={{
                            marginTop: "1rem",
                            background: "none",
                            border: "none",
                            color: "#DC2626",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "var(--radius-md)",
                            transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(220, 38, 38, 0.05)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    >
                        Remove file
                    </button>
                </>
            ) : (
                <>
                    <Upload size={24} color="var(--color-text-subtle)" style={{ margin: "0 auto 0.5rem" }} />
                    <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-main)" }}>Click to choose a file</p>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--color-text-subtle)" }}>Supported: .csv</p>
                </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                    setSelectedFile(file);
                    setStatus("idle");
                }
            }}
          />
        </div>
      </div>

      {/* Progress */}
      {(status === "encrypting" || status === "uploading") && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)" }}>
              {status === "encrypting" ? "Encrypting…" : "Uploading…"}
            </span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-main)" }}>
              {progress.done} / {progress.total}
            </span>
          </div>
          <div style={{ height: "6px", borderRadius: "3px", background: "var(--color-soft-gray)", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${(progress.done / progress.total) * 100}%`,
              background: "var(--color-security-blue)",
              borderRadius: "3px",
              transition: "width 0.2s ease",
            }} />
          </div>
        </div>
      )}

      {/* Status messages */}
      {status === "done" && (
        <div style={{ ...warningBoxStyle, background: "rgba(16,185,129,0.07)", borderColor: "rgba(16,185,129,0.2)" }}>
          <CheckCircle size={15} style={{ flexShrink: 0, color: "#059669" }} />
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-main)" }}>
            Import complete! Go to your vault to see the new items.
          </p>
        </div>
      )}
      {status === "error" && errorMsg && (
        <div style={{ ...warningBoxStyle, background: "rgba(239,68,68,0.07)", borderColor: "rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, color: "#DC2626" }} />
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-main)" }}>{errorMsg}</p>
        </div>
      )}

      <div className="flex-responsive" style={{ ...footerStyle, marginTop: "1.25rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-subtle)" }}>
          Items are always encrypted locally before upload
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleImport()}
          disabled={isLocked || status === "encrypting" || status === "uploading" || status === "parsing"}
        >
          {(status === "encrypting" || status === "uploading" || status === "parsing") ? (
            <Loader size={14} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Upload size={14} />
          )}
          <span style={{ marginLeft: "0.375rem" }}>Import</span>
        </Button>
      </div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function DataSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div className="settings-section-header" style={{ padding: "0 0.5rem" }}>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text-main)", marginBottom: "0.5rem" }}>
          Data & Portability
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)", margin: 0 }}>
          Export encrypted snapshots of your vault or migrate data from other password managers.
        </p>
      </div>
      <ExportCard />
      <ImportCard />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  padding: "1.5rem",
  borderRadius: "var(--radius-xl)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-surface, var(--color-white))",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "1rem",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "var(--color-text-main)",
  margin: "0 0 0.25rem",
};

const cardDescStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--color-text-subtle)",
  margin: 0,
};

const warningBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.625rem",
  padding: "0.875rem 1rem",
  borderRadius: "var(--radius-lg)",
  background: "rgba(217, 119, 6, 0.07)",
  border: "1px solid rgba(217, 119, 6, 0.25)",
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  paddingTop: "0.75rem",
  borderTop: "1px solid var(--color-border)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--color-text-main)",
  marginBottom: "0.5rem",
};

function iconContainerStyle(bg: string): React.CSSProperties {
  return {
    width: "2.5rem",
    height: "2.5rem",
    borderRadius: "0.75rem",
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}
