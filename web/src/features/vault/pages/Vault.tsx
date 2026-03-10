import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { useAuth } from "../../../app/providers/AuthProvider";
import { useDialog } from "../../../app/providers/DialogProvider";
import { ApiError } from "../../../lib/api";
import {
  decryptVaultItem,
  deriveMasterKey,
  encryptVaultItem,
  fromBase64,
  toBase64,
} from "../../../crypto";
import { createDefaultArgon2idKdf, createDefaultXChaCha20Poly1305 } from "../../../crypto/adapters";
import type { XChaCha20Poly1305Aead } from "../../../crypto";
import { vaultService } from "../services/vault.service";
import type { VaultItemResponse } from "../types";

import {
  DEFAULT_PERSONAL_VAULT_ID,
  DEFAULT_SECRET,
  DEFAULT_SHARED_VAULT_ID,
  type VaultCardModel,
  type VaultDirectoryEntry,
  type VaultFilter,
  type VaultSecret,
  type VaultType,
  type VaultViewItem,
} from "../vault.types";
import {
  buildVaultId,
  constantTimeEquals,
  getVaultReference,
  getVerifierSalt,
  isVerifierItem,
  KEK_VERIFIER_KIND,
  KEK_VERIFIER_TOKEN,
  KEK_VERIFIER_TOKEN_BYTES,
  MASTER_KEY_SALT_LENGTH,
  normalizeMemberList,
  normalizeSecret,
  wipeKeyMaterial,
} from "../vault.utils";

import { VaultUnlockScreen } from "../components/VaultUnlockScreen";
import { VaultGrid } from "../components/VaultGrid";
import { VaultItemForm } from "../components/VaultItemForm";
import { VaultItemsList } from "../components/VaultItemsList";
import { VaultModal } from "../components/VaultModal";

type VaultFormData = { name: string; type: VaultType; members: string };

export function Vault() {
  const { session } = useAuth();
  const dialog = useDialog();

  // ── Crypto state ───────────────────────────────────────────────────────────
  const [aead, setAead] = useState<XChaCha20Poly1305Aead | null>(null);
  const [kek, setKek] = useState<Uint8Array | null>(null);
  const [isKekVerified, setIsKekVerified] = useState(false);
  const [verifierItem, setVerifierItem] = useState<VaultItemResponse | null>(null);

  // ── Unlock form ────────────────────────────────────────────────────────────
  const [masterPassword, setMasterPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  // ── Items ──────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<VaultViewItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");

  // ── Item form ──────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<VaultSecret>(DEFAULT_SECRET);
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);

  // ── Vault directory ────────────────────────────────────────────────────────
  const [vaultFilter, setVaultFilter] = useState<VaultFilter>("all");
  const [vaultQuery, setVaultQuery] = useState("");
  const [activeVaultId, setActiveVaultId] = useState(DEFAULT_PERSONAL_VAULT_ID);
  const [vaultDirectory, setVaultDirectory] = useState<VaultDirectoryEntry[]>([]);

  // ── Vault modal ────────────────────────────────────────────────────────────
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [vaultModalMode, setVaultModalMode] = useState<"create" | "edit">("create");
  const [vaultForm, setVaultForm] = useState<VaultFormData>({ name: "", type: "personal", members: "" });
  const [editingVaultId, setEditingVaultId] = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const lockVault = useCallback((clearError = true) => {
    setKek((prev) => {
      wipeKeyMaterial(prev);
      return null;
    });
    setIsKekVerified(false);
    setVerifierItem(null);
    setItems([]);
    setEditingItemId(null);
    setDraft(DEFAULT_SECRET);
    if (clearError) setError("");
  }, []);

  const decryptItem = useCallback(
    (item: VaultItemResponse, key: Uint8Array, cipher: XChaCha20Poly1305Aead): VaultViewItem => {
      const vaultRef = getVaultReference(item.metadata);
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
        return {
          id: item.id,
          updatedAt: item.updated_at,
          secret: normalizeSecret(JSON.parse(plaintext)),
          isCorrupted: false,
          ...vaultRef,
        };
      } catch {
        return {
          id: item.id,
          updatedAt: item.updated_at,
          secret: null,
          isCorrupted: true,
          ...vaultRef,
        };
      }
    },
    [],
  );

  const verifyKek = useCallback(
    (item: VaultItemResponse, key: Uint8Array, cipher: XChaCha20Poly1305Aead): boolean => {
      try {
        const token = decryptVaultItem({
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
        return constantTimeEquals(new TextEncoder().encode(token), KEK_VERIFIER_TOKEN_BYTES);
      } catch {
        return false;
      }
    },
    [],
  );

  const loadItems = useCallback(
    async (key: Uint8Array, cipher: XChaCha20Poly1305Aead, sourceItems?: VaultItemResponse[]) => {
      setLoadingItems(true);
      setError("");
      try {
        const all = sourceItems ?? (await vaultService.listItems()).items;
        const verifierItems = all.filter(isVerifierItem);
        if (verifierItems.length > 1) {
          throw new Error("Multiple vault verifiers detected. Vault recovery is required.");
        }
        setVerifierItem(verifierItems[0] ?? null);
        setItems(all.filter((i) => !isVerifierItem(i)).map((i) => decryptItem(i, key, cipher)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load vault items");
      } finally {
        setLoadingItems(false);
      }
    },
    [decryptItem],
  );

  const upsertVerifierItem = useCallback(
    async (
      key: Uint8Array,
      salt: Uint8Array,
      cipher: XChaCha20Poly1305Aead,
      existing: VaultItemResponse | null,
    ) => {
      const payload = encryptVaultItem({ plaintext: KEK_VERIFIER_TOKEN, kek: key, aead: cipher });
      const request = {
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        wrapped_dek: payload.wrappedDek,
        wrap_nonce: payload.wrapNonce,
        algo_version: payload.version,
        metadata: { kind: KEK_VERIFIER_KIND, salt: toBase64(salt) },
      };
      return existing ? vaultService.updateItem(existing.id, request) : vaultService.createItem(request);
    },
    [],
  );

  const ensureVerifiedWriteAccess = useCallback(async () => {
    if (!kek || !aead || !isKekVerified || !verifierItem) {
      setError("Unlock the vault with a valid passphrase before making changes.");
      return false;
    }
    if (!verifyKek(verifierItem, kek, aead)) {
      lockVault(false);
      setError("Vault key verification failed. Please unlock again.");
      return false;
    }
    return true;
  }, [aead, isKekVerified, kek, lockVault, verifierItem, verifyKek]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    let active = true;
    createDefaultXChaCha20Poly1305()
      .then((cipher) => { if (active) setAead(cipher); })
      .catch(() => { if (active) setError("Failed to initialize vault encryption"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const now = new Date().toISOString();
    const displayName = session?.name?.trim() || "You";
    lockVault();
    setMasterPassword("");
    setActiveVaultId(DEFAULT_PERSONAL_VAULT_ID);
    setVaultDirectory([
      { id: DEFAULT_PERSONAL_VAULT_ID, name: "Personal Vault", type: "personal", members: [displayName], updatedAt: now, isSystem: true },
      { id: DEFAULT_SHARED_VAULT_ID, name: "Family Shared Vault", type: "shared", members: [displayName, "Family"], updatedAt: now, isSystem: true },
    ]);
  }, [lockVault, session?.userId, session?.name]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const vaults = useMemo(() => {
    const map = new Map<string, VaultCardModel>();
    for (const entry of vaultDirectory) map.set(entry.id, { ...entry, itemCount: 0 });
    for (const item of items) {
      const existing = map.get(item.vaultId);
      if (existing) {
        existing.itemCount += 1;
        if (new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          existing.updatedAt = item.updatedAt;
        }
      } else {
        map.set(item.vaultId, {
          id: item.vaultId,
          name: item.vaultName,
          type: item.vaultType,
          members: item.vaultType === "shared" ? ["You", "Family"] : [session?.name?.trim() || "You"],
          updatedAt: item.updatedAt,
          isSystem: false,
          itemCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.id === DEFAULT_PERSONAL_VAULT_ID) return -1;
      if (b.id === DEFAULT_PERSONAL_VAULT_ID) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, session?.name, vaultDirectory]);

  useEffect(() => {
    if (!vaults.some((v) => v.id === activeVaultId) && vaults.length > 0) {
      setActiveVaultId(vaults[0].id);
    }
  }, [activeVaultId, vaults]);

  const filteredVaults = useMemo(() => {
    const q = vaultQuery.trim().toLowerCase();
    return vaults.filter((v) => {
      if (vaultFilter !== "all" && v.type !== vaultFilter) return false;
      return !q || v.name.toLowerCase().includes(q);
    });
  }, [vaultFilter, vaultQuery, vaults]);

  const activeVault = useMemo(
    () => vaults.find((v) => v.id === activeVaultId) ?? vaults[0] ?? null,
    [activeVaultId, vaults],
  );

  const visibleItems = useMemo(
    () => (activeVault ? items.filter((i) => i.vaultId === activeVault.id) : []),
    [activeVault, items],
  );

  const corruptedCount = useMemo(
    () => visibleItems.filter((i) => i.isCorrupted).length,
    [visibleItems],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || !aead || unlocking) return;

    const passwordInput = masterPassword;
    setMasterPassword("");
    if (!passwordInput.trim()) { setError("Vault passphrase is required"); return; }

    setError("");
    setUnlocking(true);
    let candidateKey: Uint8Array | null = null;

    try {
      const listed = await vaultService.listItems();
      const allItems = listed.items;
      const verifierItems = allItems.filter(isVerifierItem);
      if (verifierItems.length > 1) throw new Error("Multiple vault verifiers detected. Vault recovery is required.");
      const existingVerifier = verifierItems[0] ?? null;
      const kdf = await createDefaultArgon2idKdf();

      if (existingVerifier) {
        const salt = getVerifierSalt(existingVerifier);
        if (!salt) throw new Error("Vault verifier is invalid. Please contact support.");
        const derived = await deriveMasterKey({ password: passwordInput, kdf, salt });
        candidateKey = derived.key;
        if (!verifyKek(existingVerifier, candidateKey, aead)) throw new Error("Incorrect vault passphrase");
        setKek(candidateKey);
        candidateKey = null;
        setIsKekVerified(true);
        setVerifierItem(existingVerifier);
        await loadItems(derived.key, aead, allItems);
        toast.success("Vault unlocked");
        return;
      }

      // Fetch the vault KDF salt from the server (Bug 4 fix)
      const saltResp = await vaultService.getVaultSalt();
      const salt = fromBase64(saltResp.salt);

      const encryptedDataItems = allItems.filter((i) => !isVerifierItem(i));

      const derived = await deriveMasterKey({ password: passwordInput, kdf, salt });
      candidateKey = derived.key;

      if (encryptedDataItems.length > 0) {
        const canDecryptAny = encryptedDataItems.some((i) => !decryptItem(i, derived.key, aead).isCorrupted);
        if (!canDecryptAny) throw new Error("Incorrect vault passphrase");
      }

      const createdVerifier = await upsertVerifierItem(derived.key, salt, aead, null);

      setKek(derived.key);
      candidateKey = null;
      setIsKekVerified(true);
      setVerifierItem(createdVerifier);
      await loadItems(derived.key, aead);
      toast.success(encryptedDataItems.length > 0 ? "Vault unlocked and verifier secured" : "Vault unlocked");
    } catch (err) {
      wipeKeyMaterial(candidateKey);
      lockVault(false);
      setError(err instanceof Error ? err.message : "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  const handleCreateItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeVault) { setError("Select a vault first"); return; }
    if (!(await ensureVerifiedWriteAccess())) return;
    if (!kek || !aead) return;
    if (!draft.title.trim() || !draft.password.trim()) { setError("Title and password are required"); return; }

    setSaving(true);
    setError("");
    try {
      const payload = encryptVaultItem({ plaintext: JSON.stringify(draft), kek, aead });
      const request = {
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        wrapped_dek: payload.wrappedDek,
        wrap_nonce: payload.wrapNonce,
        algo_version: payload.version,
        metadata: { kind: "login", vault_id: activeVault.id, vault_name: activeVault.name, vault_type: activeVault.type },
      };
      if (editingItemId) {
        await vaultService.updateItem(editingItemId, request);
      } else {
        await vaultService.createItem(request);
      }
      setDraft(DEFAULT_SECRET);
      setEditingItemId(null);
      setShowItemModal(false);
      await loadItems(kek, aead);
      toast.success(editingItemId ? "Vault item updated" : "Vault item saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to save vault item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: VaultViewItem) => {
    if (item.isCorrupted) { setError("Corrupted items require vault recovery and cannot be deleted."); return; }
    if (!(await ensureVerifiedWriteAccess())) return;
    if (!kek || !aead) return;

    const confirmed = await dialog.confirm({
      title: "Delete vault item",
      message: `Delete ${item.secret?.title || "this item"}? This action cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    try {
      await vaultService.deleteItem(item.id);
      if (editingItemId === item.id) { setEditingItemId(null); setDraft(DEFAULT_SECRET); }
      await loadItems(kek, aead);
      toast.success("Vault item deleted");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete vault item");
    }
  };

  const handleSaveVault = (e: FormEvent) => {
    e.preventDefault();
    const name = vaultForm.name.trim();
    if (!name) { setError("Vault name is required"); return; }
    const members = normalizeMemberList(vaultForm.members);
    const updatedAt = new Date().toISOString();

    if (vaultModalMode === "create") {
      const createdId = buildVaultId(name);
      setVaultDirectory((prev) => [
        ...prev,
        {
          id: createdId,
          name,
          type: vaultForm.type,
          members: vaultForm.type === "shared" ? (members.length > 0 ? members : ["You", "Family"]) : [session?.name?.trim() || "You"],
          updatedAt,
          isSystem: false,
        },
      ]);
      setActiveVaultId(createdId);
      toast.success("Vault created");
    } else if (editingVaultId) {
      setVaultDirectory((prev) => {
        const found = prev.some((e) => e.id === editingVaultId);
        if (!found) {
          return [...prev, { id: editingVaultId, name, type: vaultForm.type, members: vaultForm.type === "shared" ? (members.length > 0 ? members : ["You", "Family"]) : [session?.name?.trim() || "You"], updatedAt, isSystem: false }];
        }
        return prev.map((e) =>
          e.id !== editingVaultId
            ? e
            : { ...e, name, type: vaultForm.type, members: vaultForm.type === "shared" ? (members.length > 0 ? members : ["You", "Family"]) : [session?.name?.trim() || "You"], updatedAt },
        );
      });
      toast.success("Vault updated");
    }
    setShowVaultModal(false);
  };

  const handleDeleteVault = async (vault: VaultCardModel) => {
    if (vault.id === DEFAULT_PERSONAL_VAULT_ID || vault.isSystem) {
      await dialog.alert({ title: "Cannot delete system vault", message: "This vault is required for account-level storage.", confirmLabel: "Got it" });
      return;
    }
    if (vault.itemCount > 0) {
      await dialog.alert({ title: "Vault is not empty", message: "Move or delete all items in this vault before deleting it.", confirmLabel: "OK" });
      return;
    }
    const confirmed = await dialog.confirm({ title: "Delete vault", message: `Delete ${vault.name}?`, confirmLabel: "Delete vault", cancelLabel: "Cancel" });
    if (!confirmed) return;
    setVaultDirectory((prev) => prev.filter((e) => e.id !== vault.id));
    if (activeVaultId === vault.id) setActiveVaultId(DEFAULT_PERSONAL_VAULT_ID);
    toast.success("Vault deleted");
  };

  const handleManageMembers = (vault: VaultCardModel) => {
    void dialog.alert({ title: "Manage members", message: `Members: ${vault.members.join(", ") || "No members"}.`, confirmLabel: "Close" });
  };

  // ── Vault modal helpers ────────────────────────────────────────────────────

  const openCreateVaultModal = () => {
    setVaultModalMode("create");
    setEditingVaultId(null);
    setVaultForm({ name: "", type: "personal", members: "" });
    setShowVaultModal(true);
  };

  const openEditVaultModal = (vault: VaultCardModel) => {
    setVaultModalMode("edit");
    setEditingVaultId(vault.id);
    setVaultForm({ name: vault.name, type: vault.type, members: vault.members.join(", ") });
    setShowVaultModal(true);
  };

  const openCreateItemModal = () => {
    setEditingItemId(null);
    setDraft(DEFAULT_SECRET);
    setError("");
    setShowItemModal(true);
  };

  const startEdit = (item: VaultViewItem) => {
    if (!item.secret || item.isCorrupted) return;
    setEditingItemId(item.id);
    setDraft(item.secret);
    setError("");
    setShowItemModal(true);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setDraft(DEFAULT_SECRET);
    setError("");
    setShowItemModal(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!kek || !isKekVerified) {
    return (
      <VaultUnlockScreen
        masterPassword={masterPassword}
        unlocking={unlocking}
        aead={aead}
        error={error}
        onPasswordChange={setMasterPassword}
        onSubmit={handleUnlock}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <VaultGrid
        vaults={filteredVaults}
        activeVaultId={activeVaultId}
        vaultQuery={vaultQuery}
        vaultFilter={vaultFilter}
        onQueryChange={setVaultQuery}
        onFilterChange={setVaultFilter}
        onCreateVault={openCreateVaultModal}
        onOpenVault={setActiveVaultId}
        onEditVault={openEditVaultModal}
        onDeleteVault={(v) => void handleDeleteVault(v)}
        onManageMembers={handleManageMembers}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--color-text-main)", margin: 0 }}>
          {activeVault?.name ?? "Vault"}
        </h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => lockVault()}
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--color-text-subtle)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            🔒 Lock vault
          </button>
          <button
            type="button"
            onClick={openCreateItemModal}
            className="btn btn-primary"
            style={{ padding: "0.5rem 1rem" }}
          >
            + Add Item
          </button>
        </div>
      </div>

      {showItemModal && (
        <VaultItemForm
          vaultName={activeVault?.name ?? ""}
          draft={draft}
          saving={saving}
          isEditing={!!editingItemId}
          error={error}
          corruptedCount={corruptedCount}
          onDraftChange={setDraft}
          onSubmit={handleCreateItem}
          onClose={cancelEdit}
        />
      )}

      <VaultItemsList
        items={visibleItems}
        loading={loadingItems}
        onRefresh={() => { if (aead && kek) void loadItems(kek, aead); }}
        onEdit={startEdit}
        onDelete={(item) => void handleDelete(item)}
      />

      {showVaultModal && (
        <VaultModal
          mode={vaultModalMode}
          form={vaultForm}
          onFormChange={setVaultForm}
          onSubmit={handleSaveVault}
          onClose={() => setShowVaultModal(false)}
        />
      )}
    </div>
  );
}
