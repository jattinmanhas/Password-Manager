import { Shield, ExternalLink } from "lucide-react";
import { useCallback, useState } from "react";
import { getApiOrigin } from "../../shared/api";

export function LoginView() {
  const [opening, setOpening] = useState(false);

  const openWebApp = useCallback(async () => {
    setOpening(true);
    const origin = await getApiOrigin();
    // The web app is typically served from the same origin or a known URL
    // For local dev, it's http://localhost:5173
    const webAppUrl = origin.replace(":8080", ":5173");
    chrome.tabs.create({ url: webAppUrl });
    setOpening(false);
  }, []);

  return (
    <div className="popup-centered">
      <div className="popup-centered-icon">
        <Shield size={24} />
      </div>
      <h2>Welcome to PMV2</h2>
      <p>
        Log in to your PMV2 account in the web app first, then return here to
        access your vault.
      </p>
      <button
        className="btn btn-primary"
        onClick={openWebApp}
        disabled={opening}
        style={{ width: "100%", maxWidth: "240px", gap: "0.5rem" }}
      >
        <ExternalLink size={16} />
        Open PMV2 Web App
      </button>
    </div>
  );
}
