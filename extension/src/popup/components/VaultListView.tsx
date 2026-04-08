import { useState, useMemo, useEffect } from "react";
import { Search, Globe, Inbox } from "lucide-react";
import type { VaultViewItem, LoginSecret } from "../../shared/types/vault.types";
import type { FillCredentialsResult } from "../../shared/types/extension.types";
import { VaultItemRow } from "./VaultItemRow";

interface VaultListViewProps {
  items: VaultViewItem[];
}

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function VaultListView({ items }: VaultListViewProps) {
  const [query, setQuery] = useState("");
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabUrl = tabs[0]?.url;
      if (tabUrl) {
        setCurrentDomain(getDomain(tabUrl));
      }
    });
  }, []);

  // Only show login items
  const loginItems = useMemo(
    () =>
      items.filter(
        (item): item is VaultViewItem & { secret: LoginSecret } =>
          item.secret?.kind === "login" && !item.deletedAt && !item.isCorrupted
      ),
    [items]
  );

  // Split into domain matches and others
  const { domainMatches, otherItems } = useMemo(() => {
    if (!currentDomain) return { domainMatches: loginItems, otherItems: [] };

    const matches: typeof loginItems = [];
    const others: typeof loginItems = [];

    for (const item of loginItems) {
      const itemDomain = getDomain(item.secret.url || "");
      if (itemDomain && isDomainMatch(currentDomain, itemDomain)) {
        matches.push(item);
      } else {
        others.push(item);
      }
    }

    return { domainMatches: matches, otherItems: others };
  }, [loginItems, currentDomain]);

  // Filter by search query
  const filterFn = (item: typeof loginItems[number]) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.secret.title.toLowerCase().includes(q) ||
      item.secret.username.toLowerCase().includes(q) ||
      item.secret.url.toLowerCase().includes(q)
    );
  };

  const filteredDomain = domainMatches.filter(filterFn);
  const filteredOther = otherItems.filter(filterFn);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`);
    } catch {
      showToast("Copy failed");
    }
  };

  const handleFill = async (item: typeof loginItems[number]) => {
    const result = (await chrome.runtime.sendMessage({
      type: "fill-credentials",
      username: item.secret.username,
      password: item.secret.password,
    })) as FillCredentialsResult | undefined;

    if (result?.ok) {
      showToast(
        result.filledUsername && result.filledPassword
          ? "Credentials filled"
          : result.filledPassword
            ? "Password filled"
            : "Username filled"
      );
    } else {
      showToast(result?.reason || "No login fields found");
      return;
    }

    // Close popup after a short delay
    setTimeout(() => window.close(), 500);
  };

  const renderItem = (item: typeof loginItems[number]) => (
    <VaultItemRow
      key={item.id}
      title={item.secret.title}
      username={item.secret.username}
      url={item.secret.url}
      onCopyUsername={() => copyToClipboard(item.secret.username, "Username")}
      onCopyPassword={() => copyToClipboard(item.secret.password, "Password")}
      onFill={() => handleFill(item)}
    />
  );

  return (
    <div>
      {/* Search */}
      <div className="vault-search">
        <Search size={14} className="vault-search-icon" />
        <input
          className="input"
          type="search"
          placeholder="Search credentials..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Domain matches */}
      {filteredDomain.length > 0 && (
        <>
          <div className="vault-domain-label">
            <Globe size={12} />
            {currentDomain || "Current tab"}
          </div>
          <div className="vault-item-list">
            {filteredDomain.map(renderItem)}
          </div>
        </>
      )}

      {/* Separator */}
      {filteredDomain.length > 0 && filteredOther.length > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            margin: "0.75rem 0",
          }}
        />
      )}

      {/* Other items */}
      {filteredOther.length > 0 && (
        <>
          {filteredDomain.length > 0 && (
            <div className="vault-domain-label">All credentials</div>
          )}
          <div className="vault-item-list">
            {filteredOther.map(renderItem)}
          </div>
        </>
      )}

      {/* Empty state */}
      {filteredDomain.length === 0 && filteredOther.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Inbox size={20} />
          </div>
          <h3>
            {query ? "No matches found" : "No login credentials"}
          </h3>
          <p>
            {query
              ? "Try a different search term."
              : "Add credentials in the PMV2 web app."}
          </p>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="copy-toast">{toast}</div>}
    </div>
  );
}

function isDomainMatch(currentDomain: string, itemDomain: string): boolean {
  return currentDomain === itemDomain || currentDomain.endsWith(`.${itemDomain}`);
}
