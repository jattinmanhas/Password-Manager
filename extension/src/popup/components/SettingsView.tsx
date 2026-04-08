import { useState, useEffect } from "react";
import { Save, Check, Server } from "lucide-react";
import { getApiOrigin, setApiOrigin } from "../../shared/api";

export function SettingsView() {
  const [apiUrl, setApiUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApiOrigin().then((origin) => {
      setApiUrl(origin);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!apiUrl.trim()) return;
    await setApiOrigin(apiUrl.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h3
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: "var(--color-text-main)",
            marginBottom: "0.25rem",
          }}
        >
          Extension Settings
        </h3>
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-subtle)",
          }}
        >
          Configure how PMV2 connects to your server.
        </p>
      </div>

      {/* Backend URL */}
      <div className="settings-section">
        <div className="settings-label">
          <Server size={12} style={{ display: "inline", verticalAlign: "middle" }} />
          {" "}Backend URL
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            className="input"
            type="url"
            placeholder="http://localhost:8080"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            style={{ flex: 1, height: "2.5rem", fontSize: "0.8125rem" }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSave}
            style={{
              width: "auto",
              padding: "0 0.75rem",
              height: "2.5rem",
              gap: "0.375rem",
              fontSize: "0.8125rem",
              flexShrink: 0,
            }}
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
        <p className="settings-value">
          The URL of your PMV2 backend server. Change this when deploying to
          production.
        </p>
      </div>

      {/* About */}
      <div
        style={{
          borderTop: "1px solid var(--color-border)",
          paddingTop: "1rem",
        }}
      >
        <div className="settings-label">About</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
            fontSize: "0.75rem",
            color: "var(--color-text-light)",
          }}
        >
          <span>PMV2 Extension v0.1.0</span>
          <span>Zero-knowledge password manager</span>
          <span>
            All encryption happens locally. Your passwords never leave your
            browser in plaintext.
          </span>
        </div>
      </div>
    </div>
  );
}
