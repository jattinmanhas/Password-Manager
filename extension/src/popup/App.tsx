import { useState, useEffect, useCallback } from "react";
import { PopupHeader } from "./components/PopupHeader";
import { LoginView } from "./components/LoginView";
import { UnlockView } from "./components/UnlockView";
import { VaultListView } from "./components/VaultListView";
import { PasswordGenerator } from "./components/PasswordGenerator";
import { SettingsView } from "./components/SettingsView";
import { SavePromptCard } from "./components/SavePromptCard";
import { authService } from "../shared/services";
import { encryptVaultItem, fromBase64 } from "../shared/crypto";
import { createDefaultXChaCha20Poly1305 } from "../shared/crypto/adapters";
import { decryptVaultItemsWithWorker } from "../shared/crypto/worker-client";
import { vaultService } from "../shared/services";
import { isVerifierItem } from "../shared/vault.utils";
import type { VaultViewItem } from "../shared/types/vault.types";
import type { PendingLoginCapture } from "../shared/types/extension.types";

type AppState = "loading" | "login" | "unlock" | "ready";
type Tab = "vault" | "generator" | "settings";

export function App() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [activeTab, setActiveTab] = useState<Tab>("vault");
  const [email, setEmail] = useState<string>("");
  const [items, setItems] = useState<VaultViewItem[]>([]);
  const [kek, setKek] = useState<Uint8Array | null>(null);
  const [pendingLogin, setPendingLogin] = useState<PendingLoginCapture | null>(null);
  const [pendingLoginSaving, setPendingLoginSaving] = useState(false);
  const [pendingLoginError, setPendingLoginError] = useState("");

  // ── Bootstrap: check auth session + vault lock state ──────────────

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    setAppState("loading");

    // 1. Check if user is authenticated (session cookie)
    try {
      const session = await authService.me();
      setEmail(session.email);
    } catch {
      setAppState("login");
      return;
    }

    // 2. Check if vault is unlocked (KEK in session storage)
    try {
      const response = await chrome.runtime.sendMessage({ type: "vault-status" });
      if (response?.isUnlocked && response.kekBase64) {
        // Vault is unlocked — decrypt and load items
        const kek = fromBase64(response.kekBase64);
        setKek(kek);
        await loadItems(kek);
        await refreshPendingLogin();
        setAppState("ready");
        return;
      }
    } catch {
      // Background not available
    }

    setAppState("unlock");
    setKek(null);
  };

  const loadItems = async (kek: Uint8Array) => {
    try {
      const listed = await vaultService.listItems();
      const dataItems = listed.items.filter((i) => !isVerifierItem(i));
      const decrypted = await decryptVaultItemsWithWorker({
        items: dataItems,
        kek,
      });
      setItems(decrypted);
    } catch (err) {
      console.error("Failed to load vault items:", err);
    }
  };

  const handleUnlocked = useCallback(
    (_kek: Uint8Array, decryptedItems: VaultViewItem[]) => {
      setKek(_kek);
      setItems(decryptedItems);
      setAppState("ready");
      void refreshPendingLogin();
    },
    []
  );

  const handleLock = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: "vault-lock" });
    setItems([]);
    setKek(null);
    setPendingLogin(null);
    setPendingLoginError("");
    setAppState("unlock");
    setActiveTab("vault");
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
  };

  const refreshPendingLogin = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "get-pending-login" });
      setPendingLogin(response?.pendingLogin ?? null);
    } catch {
      setPendingLogin(null);
    }
  }, []);

  const dismissPendingLogin = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: "dismiss-pending-login" });
    setPendingLogin(null);
    setPendingLoginError("");
  }, []);

  const savePendingLogin = useCallback(async () => {
    if (!pendingLogin || !kek) {
      return;
    }

    setPendingLoginSaving(true);
    setPendingLoginError("");

    try {
      const aead = await createDefaultXChaCha20Poly1305();
      const payload = encryptLoginCapture(pendingLogin, kek, aead);
      await vaultService.createItem(payload);
      await dismissPendingLogin();
      await loadItems(kek);
    } catch (error) {
      setPendingLoginError(
        error instanceof Error ? error.message : "Failed to save captured login."
      );
    } finally {
      setPendingLoginSaving(false);
    }
  }, [dismissPendingLogin, kek, pendingLogin]);

  useEffect(() => {
    if (appState === "ready" && activeTab === "vault") {
      void refreshPendingLogin();
    }
  }, [activeTab, appState, refreshPendingLogin]);

  // ── Render ────────────────────────────────────────────────────────

  if (appState === "loading") {
    return (
      <div className="popup-container">
        <PopupHeader
          isUnlocked={false}
          onLock={handleLock}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        <div className="popup-centered">
          <div
            className="popup-centered-icon"
            style={{ animation: "pulse 1.5s ease-in-out infinite" }}
          >
            <svg
              className="loading-spinner"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              width="20"
              height="20"
            >
              <circle
                style={{ opacity: 0.25 }}
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                style={{ opacity: 0.75 }}
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p>Connecting...</p>
        </div>
      </div>
    );
  }

  if (appState === "login") {
    return (
      <div className="popup-container">
        <PopupHeader
          isUnlocked={false}
          onLock={handleLock}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        <LoginView />
      </div>
    );
  }

  if (appState === "unlock") {
    return (
      <div className="popup-container">
        <PopupHeader
          email={email}
          isUnlocked={false}
          onLock={handleLock}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        <UnlockView onUnlocked={handleUnlocked} />
      </div>
    );
  }

  // appState === "ready"
  return (
    <div className="popup-container">
      <PopupHeader
        email={email}
        isUnlocked={true}
        onLock={handleLock}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      <div className="popup-content">
        {activeTab === "vault" && (
          <>
            {pendingLogin ? (
              <SavePromptCard
                capture={pendingLogin}
                saving={pendingLoginSaving}
                error={pendingLoginError}
                onSave={savePendingLogin}
                onDismiss={dismissPendingLogin}
              />
            ) : null}
            <VaultListView items={items} />
          </>
        )}
        {activeTab === "generator" && <PasswordGenerator />}
        {activeTab === "settings" && <SettingsView />}
      </div>
    </div>
  );
}

function encryptLoginCapture(
  pendingLogin: PendingLoginCapture,
  kek: Uint8Array,
  aead: Awaited<ReturnType<typeof createDefaultXChaCha20Poly1305>>,
) {
  const plaintext = JSON.stringify({
    kind: "login",
    title: pendingLogin.title,
    username: pendingLogin.username,
    password: pendingLogin.password,
    url: pendingLogin.url,
    notes: "",
  });

  const encrypted = encryptVaultItem({ plaintext, kek, aead });
  return {
    ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce,
    wrapped_dek: encrypted.wrappedDek,
    wrap_nonce: encrypted.wrapNonce,
    algo_version: encrypted.version,
    metadata: {
      kind: "login",
      vault_id: "personal-main",
      vault_name: "Personal Vault",
      vault_type: "personal",
    },
  };
}
