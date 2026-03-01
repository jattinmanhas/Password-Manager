import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { Card } from "../../../components/ui/Card";
import { Label } from "../../../components/ui/Label";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useDialog } from "../../../app/providers/DialogProvider";
import { ApiError } from "../../../lib/api";
import {
  decryptVaultItem,
  deriveMasterKey,
  encryptVaultItem,
  fromBase64,
  randomBytes,
  toBase64,
} from "../../../crypto";
import { createDefaultArgon2idKdf, createDefaultXChaCha20Poly1305 } from "../../../crypto/adapters";
import type { XChaCha20Poly1305Aead } from "../../../crypto";
import { vaultService } from "../services/vault.service";
import type { VaultItemResponse } from "../types";

interface VaultSecret {
  title: string;
  username: string;
  password: string;
  notes: string;
}

interface VaultViewItem {
  id: string;
  updatedAt: string;
  secret: VaultSecret | null;
  isCorrupted: boolean;
}

const DEFAULT_SECRET: VaultSecret = {
  title: "",
  username: "",
  password: "",
  notes: "",
};

function normalizeSecret(input: unknown): VaultSecret {
  if (!input || typeof input !== "object") {
    return DEFAULT_SECRET;
  }
  const value = input as Record<string, unknown>;
  return {
    title: typeof value.title === "string" ? value.title : "",
    username: typeof value.username === "string" ? value.username : "",
    password: typeof value.password === "string" ? value.password : "",
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

export function Vault() {
  const { session } = useAuth();
  const dialog = useDialog();
  const [aead, setAead] = useState<XChaCha20Poly1305Aead | null>(null);
  const [kek, setKek] = useState<Uint8Array | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const [items, setItems] = useState<VaultViewItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState<VaultSecret>(DEFAULT_SECRET);
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createDefaultXChaCha20Poly1305()
      .then((cipher) => {
        if (active) {
          setAead(cipher);
        }
      })
      .catch(() => {
        if (active) {
          setError("Failed to initialize vault encryption");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setKek(null);
    setItems([]);
    setMasterPassword("");
    setDraft(DEFAULT_SECRET);
  }, [session?.userId]);

  const decryptItem = useCallback(
    (item: VaultItemResponse, key: Uint8Array, cipher: XChaCha20Poly1305Aead): VaultViewItem => {
      try {
        const plaintext = decryptVaultItem({
          payload: {
            version: "xchacha20poly1305-v1",
            nonce: item.nonce,
            ciphertext: item.ciphertext,
            wrappedDek: item.wrapped_dek,
            wrapNonce: item.wrap_nonce,
          },
          kek: key,
          aead: cipher,
        });
        const parsed = JSON.parse(plaintext);
        return {
          id: item.id,
          updatedAt: item.updated_at,
          secret: normalizeSecret(parsed),
          isCorrupted: false,
        };
      } catch {
        return {
          id: item.id,
          updatedAt: item.updated_at,
          secret: null,
          isCorrupted: true,
        };
      }
    },
    [],
  );

  const loadItems = useCallback(
    async (key: Uint8Array, cipher: XChaCha20Poly1305Aead) => {
      setLoadingItems(true);
      setError("");
      try {
        const response = await vaultService.listItems();
        const nextItems = response.items.map((item) => decryptItem(item, key, cipher));
        setItems(nextItems);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load vault items");
        }
      } finally {
        setLoadingItems(false);
      }
    },
    [decryptItem],
  );

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || !aead) {
      return;
    }
    setError("");
    setUnlocking(true);
    try {
      const storageKey = `pmv2:vault-salt:${session.userId}`;
      let salt: Uint8Array;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        salt = fromBase64(stored);
      } else {
        salt = randomBytes(16);
        localStorage.setItem(storageKey, toBase64(salt));
      }

      const kdf = await createDefaultArgon2idKdf();
      const derived = await deriveMasterKey({
        password: masterPassword,
        kdf,
        salt,
      });
      setKek(derived.key);
      setMasterPassword("");
      await loadItems(derived.key, aead);
      toast.success("Vault unlocked");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to unlock vault");
      }
    } finally {
      setUnlocking(false);
    }
  };

  const handleCreateItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!kek || !aead) {
      return;
    }
    if (!draft.title.trim() || !draft.password.trim()) {
      setError("Title and password are required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = encryptVaultItem({
        plaintext: JSON.stringify(draft),
        kek,
        aead,
      });
      if (editingItemId) {
        await vaultService.updateItem(editingItemId, {
          ciphertext: payload.ciphertext,
          nonce: payload.nonce,
          wrapped_dek: payload.wrappedDek,
          wrap_nonce: payload.wrapNonce,
          algo_version: payload.version,
          metadata: { kind: "login" },
        });
      } else {
        await vaultService.createItem({
          ciphertext: payload.ciphertext,
          nonce: payload.nonce,
          wrapped_dek: payload.wrappedDek,
          wrap_nonce: payload.wrapNonce,
          algo_version: payload.version,
          metadata: { kind: "login" },
        });
      }

      setDraft(DEFAULT_SECRET);
      setEditingItemId(null);
      await loadItems(kek, aead);
      toast.success(editingItemId ? "Vault item updated" : "Vault item saved");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save vault item");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemID: string) => {
    if (!kek || !aead) {
      return;
    }

    const confirmed = await dialog.confirm({
      title: "Delete vault item",
      message: "This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) {
      return;
    }

    try {
      await vaultService.deleteItem(itemID);
      if (editingItemId === itemID) {
        setEditingItemId(null);
        setDraft(DEFAULT_SECRET);
      }
      await loadItems(kek, aead);
      toast.success("Vault item deleted");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to delete vault item");
      }
    }
  };

  const corruptedCount = useMemo(() => items.filter((item) => item.isCorrupted).length, [items]);

  const startEdit = (item: VaultViewItem) => {
    if (!item.secret) {
      return;
    }
    setEditingItemId(item.id);
    setDraft(item.secret);
    setError("");
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setDraft(DEFAULT_SECRET);
    setError("");
  };

  if (!kek) {
    return (
      <div style={{ maxWidth: "32rem", margin: "0 auto" }}>
        <Card>
          <h1 className="card-title">Unlock Vault</h1>
          <p className="card-desc">Enter your vault passphrase to derive your encryption key locally.</p>
          {error && <div className="alert-error">{error}</div>}
          <form className="form-stack" onSubmit={handleUnlock}>
            <div className="form-group">
              <Label htmlFor="master-password">Vault Passphrase</Label>
              <Input
                id="master-password"
                type="password"
                autoComplete="current-password"
                required
                value={masterPassword}
                onChange={(event) => setMasterPassword(event.target.value)}
                disabled={unlocking || !aead}
              />
            </div>
            <Button type="submit" isLoading={unlocking} disabled={!aead || masterPassword.length === 0}>
              Unlock Vault
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h1 className="card-title">Vault</h1>
            <p className="card-desc" style={{ marginBottom: 0 }}>
              Encrypted items are stored server-side; encryption/decryption happens in your browser.
            </p>
          </div>
          <button
            type="button"
            style={{ color: "var(--color-text-subtle)", fontSize: "0.875rem", fontWeight: 600 }}
            onClick={() => {
              setKek(null);
              setItems([]);
              setError("");
            }}
          >
            Lock vault
          </button>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {corruptedCount > 0 && (
          <div className="alert-error">
            {corruptedCount} item(s) could not be decrypted with the current passphrase.
          </div>
        )}

        <form className="form-stack" onSubmit={handleCreateItem}>
          <div className="form-group">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              type="text"
              placeholder="e.g. GitHub"
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              disabled={saving}
              required
            />
          </div>
          <div className="form-group">
            <Label htmlFor="username">Username / Email</Label>
            <Input
              id="username"
              type="text"
              value={draft.username}
              onChange={(event) => setDraft((prev) => ({ ...prev, username: event.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="form-group">
            <Label htmlFor="entry-password">Password</Label>
            <Input
              id="entry-password"
              type="text"
              value={draft.password}
              onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))}
              disabled={saving}
              required
            />
          </div>
          <div className="form-group">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              style={{
                width: "100%",
                minHeight: "5.5rem",
                padding: "0.75rem",
                borderRadius: "var(--radius-xl)",
                border: "1px solid var(--color-border)",
                fontFamily: "inherit",
                fontSize: "0.875rem",
              }}
              value={draft.notes}
              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
              disabled={saving}
            />
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Button type="submit" isLoading={saving}>
              {editingItemId ? "Update Item" : "Save Item"}
            </Button>
            {editingItemId && (
              <Button type="button" variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h2 className="card-title" style={{ marginBottom: 0 }}>Saved Items</h2>
          <button
            type="button"
            style={{ color: "var(--color-security-blue)", fontSize: "0.8125rem", fontWeight: 600 }}
            onClick={() => {
              if (aead) {
                void loadItems(kek, aead);
              }
            }}
          >
            Refresh
          </button>
        </div>
        <p className="card-desc">Showing {items.length} item(s).</p>
        {loadingItems ? (
          <p style={{ color: "var(--color-text-subtle)" }}>Loading items...</p>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--color-text-subtle)" }}>No items yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-xl)",
                  padding: "0.875rem",
                  backgroundColor: "var(--color-soft-gray)",
                }}
              >
                {item.isCorrupted || !item.secret ? (
                  <p style={{ color: "var(--color-red)", fontWeight: 600 }}>Unable to decrypt this item</p>
                ) : (
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <p style={{ fontWeight: 700 }}>{item.secret.title || "Untitled"}</p>
                    {item.secret.username && <p style={{ color: "var(--color-text-subtle)" }}>{item.secret.username}</p>}
                    <p style={{ fontFamily: "monospace" }}>{item.secret.password}</p>
                    {item.secret.notes && <p style={{ color: "var(--color-text-subtle)" }}>{item.secret.notes}</p>}
                  </div>
                )}

                <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-light)" }}>
                    Updated {new Date(item.updatedAt).toLocaleString()}
                  </span>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    {!item.isCorrupted && item.secret && (
                      <button
                        type="button"
                        style={{ color: "var(--color-security-blue)", fontSize: "0.8125rem", fontWeight: 600 }}
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      style={{ color: "var(--color-red)", fontSize: "0.8125rem", fontWeight: 600 }}
                      onClick={() => void handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
