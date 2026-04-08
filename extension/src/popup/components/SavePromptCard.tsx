import { Loader2, Save, X, Globe, User } from "lucide-react";
import type { PendingLoginCapture } from "../../shared/types/extension.types";

interface SavePromptCardProps {
  capture: PendingLoginCapture;
  saving: boolean;
  error?: string;
  onSave: () => void;
  onDismiss: () => void;
}

export function SavePromptCard({
  capture,
  saving,
  error,
  onSave,
  onDismiss,
}: SavePromptCardProps) {
  const hostname = safeHostname(capture.url);

  return (
    <section className="save-prompt-card">
      <div className="save-prompt-header">
        <div>
          <div className="save-prompt-eyebrow">Suggested Save</div>
          <h3 className="save-prompt-title">{capture.title || hostname || "New login"}</h3>
        </div>
        <button
          className="popup-icon-btn"
          onClick={onDismiss}
          title="Dismiss"
          disabled={saving}
        >
          <X size={15} />
        </button>
      </div>

      <div className="save-prompt-meta">
        <span><Globe size={12} /> {hostname || capture.url}</span>
        <span><User size={12} /> {capture.username}</span>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}

      <div className="save-prompt-actions">
        <button className="btn btn-outline" onClick={onDismiss} disabled={saving}>
          Not now
        </button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="loading-spinner" /> : <Save size={16} />}
          {saving ? "Saving..." : "Save login"}
        </button>
      </div>
    </section>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
