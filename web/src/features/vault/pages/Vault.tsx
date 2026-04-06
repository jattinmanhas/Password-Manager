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
  utf8ToBytes,
  bytesToUtf8,
  randomBytes,
} from "../../../crypto";
import { createDefaultArgon2idKdf } from "../../../crypto/adapters";
import type { XChaCha20Poly1305Aead } from "../../../crypto";
import { generateX25519KeyPair, encryptPrivateKey, decryptPrivateKey } from "../../../crypto/sharing";
import { vaultService } from "../services/vault.service";
import { sharingService } from "../services/sharing.service";
import type { FolderResponse, FoldersResponse, VaultItemResponse, VaultItemVersionResponse } from "../types";

import {
  DEFAULT_PERSONAL_VAULT_ID,
  DEFAULT_SECRET,
  DEFAULT_SHARED_VAULT_ID,
  TRASH_VAULT_ID,
  type VaultCardModel,
  type VaultDirectoryEntry,
  type VaultFilter,
  type VaultFolder,
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
  normalizeMemberList,
  normalizeSecret,
  wipeKeyMaterial,
} from "../vault.utils";

import { useVaultSession } from "../../../app/providers/VaultProvider";

import { VaultUnlockScreen } from "../components/VaultUnlockScreen";
import { VaultSidebar } from "../components/VaultSidebar";
import { VaultItemForm } from "../components/VaultItemForm";
import { VaultItemHistoryModal } from "../components/VaultItemHistoryModal";
import { VaultItemsList } from "../components/VaultItemsList";
import { VaultModal } from "../components/VaultModal";
import { VaultItemViewModal } from "../components/VaultItemViewModal";
import { ShareItemModal } from "../components/ShareItemModal";
import { Search, Plus, SlidersHorizontal } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";

import type { VaultModalFormData, VaultUnlockFormData, VaultItemFormData } from "../../../lib/validations/vault";

export function Vault() {
  const { session } = useAuth();
  const dialog = useDialog();

  // ── Crypto & Session State from Context ────────────────────────────────────
  const {
    aead,
    kek,
    isKekVerified,
    verifierItem,
    items,
    userPublicKey,
    userPrivateKey,
    setVaultSession,
    setItems,
    setUserKeyPair,
    lockVault: contextLockVault,
  } = useVaultSession();

  // ── Unlock form ────────────────────────────────────────────────────────────
  const [unlocking, setUnlocking] = useState(false);

  // ── Items UI State ─────────────────────────────────────────────────────────
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");

  // ── Folder & Tag State ─────────────────────────────────────────────────────
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  // ── Item form ──────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<VaultSecret>(DEFAULT_SECRET);
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<VaultViewItem | null>(null);
  const [itemFolderId, setItemFolderId] = useState<string | undefined>();
  const [sharingItem, setSharingItem] = useState<VaultViewItem | null>(null);
  const [trashedItems, setTrashedItems] = useState<VaultViewItem[]>([]);
  const [historyItem, setHistoryItem] = useState<VaultViewItem | null>(null);
  const [historyVersions, setHistoryVersions] = useState<VaultViewItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Vault directory ────────────────────────────────────────────────────────
  const [vaultFilter, setVaultFilter] = useState<string>("all");
  const [vaultQuery, setVaultQuery] = useState("");
  const [activeVaultId, setActiveVaultId] = useState(DEFAULT_PERSONAL_VAULT_ID);
  const [vaultDirectory, setVaultDirectory] = useState<VaultDirectoryEntry[]>([]);

  // ── Vault modal ────────────────────────────────────────────────────────────
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [vaultModalMode, setVaultModalMode] = useState<"create" | "edit">("create");
  const [vaultFormInitial, setVaultFormInitial] = useState<VaultModalFormData>({ name: "", type: "personal", members: "" });
  const [editingVaultId, setEditingVaultId] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const lockVault = useCallback((clearError = true) => {
    contextLockVault();
    setEditingItemId(null);
    setDraft(DEFAULT_SECRET);
    setItemFolderId(undefined);
    setFolders([]);
    setTrashedItems([]);
    setViewingItem(null);
    setHistoryItem(null);
    setHistoryVersions([]);
    setSelectedFolderId(undefined);
    setTagFilter([]);
    if (clearError) setError("");
  }, [contextLockVault]);

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
          folderId: item.folder_id,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          deletedAt: item.deleted_at,
          version: item.version,
          secret: normalizeSecret(JSON.parse(plaintext)),
          isCorrupted: false,
          isShared: item.is_shared,
          ...vaultRef,
        };
      } catch {
        return {
          id: item.id,
          folderId: item.folder_id,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          deletedAt: item.deleted_at,
          version: item.version,
          secret: null,
          isCorrupted: true,
          ...vaultRef,
        };
      }
    },
    [],
  );

  const decryptFolder = useCallback(
    (f: FolderResponse, key: Uint8Array, cipher: XChaCha20Poly1305Aead): VaultFolder => {
      try {
        const ciphertextBytes = fromBase64(f.name_ciphertext);
        const nonceBytes = fromBase64(f.nonce);
        const plaintext = cipher.decrypt({
          key,
          nonce: nonceBytes,
          ciphertext: ciphertextBytes
        });
        const name = bytesToUtf8(plaintext);
        return {
          id: f.id,
          name,
          updatedAt: f.updated_at,
        };
      } catch {
        return {
          id: f.id,
          name: "Corrupted Folder",
          updatedAt: f.updated_at,
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
        const [itemsResp, trashResp, foldersResp] = await Promise.all([
          sourceItems ? { items: sourceItems } : vaultService.listItems(),
          vaultService.listTrashItems(),
          vaultService.listFolders(),
        ]);

        const all = itemsResp.items;
        const verifierItems = all.filter(isVerifierItem);
        if (verifierItems.length > 1) {
          throw new Error("Multiple vault verifiers detected. Vault recovery is required.");
        }
        
        setFolders(foldersResp.folders.map(f => decryptFolder(f, key, cipher)));
        setItems(all.filter((i) => !isVerifierItem(i)).map((i) => decryptItem(i, key, cipher)));
        setTrashedItems(trashResp.items.map((i) => decryptItem(i, key, cipher)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load vault items");
      } finally {
        setLoadingItems(false);
      }
    },
    [decryptFolder, decryptItem, setItems],
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
    const now = new Date().toISOString();
    const displayName = session?.name?.trim() || "You";
    setActiveVaultId(DEFAULT_PERSONAL_VAULT_ID);
    setVaultDirectory([
      { id: DEFAULT_PERSONAL_VAULT_ID, name: "Personal Vault", type: "personal", members: [displayName], updatedAt: now, isSystem: true },
      { id: DEFAULT_SHARED_VAULT_ID, name: "Family Shared Vault", type: "shared", members: [displayName, "Family"], updatedAt: now, isSystem: true },
      { id: TRASH_VAULT_ID, name: "Trash", type: "personal", members: [displayName], updatedAt: now, isSystem: true },
    ]);
  }, [session?.userId, session?.name]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => {
      item.secret?.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [items]);

  const vaults = useMemo(() => {
    const list: VaultCardModel[] = [
      {
        id: DEFAULT_PERSONAL_VAULT_ID,
        name: "Personal Vault",
        type: "personal",
        members: [session?.name?.trim() || "You"],
        updatedAt: new Date().toISOString(),
        isSystem: true,
        itemCount: 0,
      },
      {
        id: DEFAULT_SHARED_VAULT_ID,
        name: "Family Shared Vault",
        type: "shared",
        members: [session?.name?.trim() || "You", "Family"],
        updatedAt: new Date().toISOString(),
        isSystem: true,
        itemCount: 0,
      },
      {
        id: TRASH_VAULT_ID,
        name: "Trash",
        type: "personal",
        members: [session?.name?.trim() || "You"],
        updatedAt: new Date().toISOString(),
        isSystem: true,
        itemCount: trashedItems.length,
      },
    ];

    // Add real backend folders as vaults
    for (const f of folders) {
      list.push({
        id: f.id,
        name: f.name,
        type: "personal", // Folders are personal for now
        members: [session?.name?.trim() || "You"],
        updatedAt: f.updatedAt,
        isSystem: false,
        itemCount: 0,
      });
    }

    // Calculate item counts
    for (const item of items) {
      const targetId = item.folderId || item.vaultId;
      const v = list.find((x) => x.id === targetId);
      if (v) {
        v.itemCount += 1;
        if (new Date(item.updatedAt).getTime() > new Date(v.updatedAt).getTime()) {
          v.updatedAt = item.updatedAt;
        }
      }
    }

    const trashVault = list.find((entry) => entry.id === TRASH_VAULT_ID);
    if (trashVault) {
      for (const item of trashedItems) {
        trashVault.itemCount += 1;
        const updatedAt = item.deletedAt || item.updatedAt;
        if (new Date(updatedAt).getTime() > new Date(trashVault.updatedAt).getTime()) {
          trashVault.updatedAt = updatedAt;
        }
      }
    }

    return list.sort((a, b) => {
      if (a.id === DEFAULT_PERSONAL_VAULT_ID) return -1;
      if (b.id === DEFAULT_PERSONAL_VAULT_ID) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [folders, items, session?.name, trashedItems]);

  useEffect(() => {
    if (!vaults.some((v) => v.id === activeVaultId) && vaults.length > 0) {
      setActiveVaultId(vaults[0].id);
    }
  }, [activeVaultId, vaults]);

  const filteredVaults = useMemo(() => vaults, [vaults]);

  const activeVault = useMemo(
    () => vaults.find((v) => v.id === activeVaultId) ?? vaults[0] ?? null,
    [activeVaultId, vaults],
  );

  const isTrashView = activeVault?.id === TRASH_VAULT_ID;

  const visibleItems = useMemo(() => {
    if (!activeVault) return [];
    let filtered = isTrashView ? [...trashedItems] : items.filter((i) => i.vaultId === activeVault.id);

    // Filter by selected folder in the sidebar (Multi-Vault)
    if (!isTrashView && selectedFolderId) {
      filtered = filtered.filter((i) => i.folderId === selectedFolderId);
    }

    // Filter by active tags
    if (tagFilter.length > 0) {
      filtered = filtered.filter((i) => {
        if (!i.secret?.tags) return false;
        return tagFilter.every((t) => i.secret?.tags?.includes(t));
      });
    }

    // Filter by Item Type dropdown
    if (vaultFilter !== "all") {
      filtered = filtered.filter((i) => i.secret?.kind === vaultFilter);
    }

    // Filter by search query
    const q = vaultQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((i) => {
        const s = i.secret;
        if (!s) return false;
        return (
          s.title?.toLowerCase().includes(q) ||
          (s as any).username?.toLowerCase().includes(q) ||
          (s as any).notes?.toLowerCase().includes(q) ||
          (s as any).cardholderName?.toLowerCase().includes(q) ||
          (s as any).bankName?.toLowerCase().includes(q)
        );
      });
    }

    return filtered;
  }, [activeVault, isTrashView, items, selectedFolderId, tagFilter, trashedItems, vaultFilter, vaultQuery]);

  const corruptedCount = useMemo(
    () => visibleItems.filter((i) => i.isCorrupted).length,
    [visibleItems],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleUnlock = async (data: VaultUnlockFormData) => {
    if (!session || !aead || unlocking) return;

    const passwordInput = data.masterPassword;
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
        setVaultSession(candidateKey, existingVerifier, true);
        candidateKey = null;
        await loadItems(derived.key, aead, allItems);
        await bootstrapUserKeys(derived.key, aead);
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

      setVaultSession(derived.key, createdVerifier, true);
      candidateKey = null;
      await loadItems(derived.key, aead);
      await bootstrapUserKeys(derived.key, aead);
      toast.success(encryptedDataItems.length > 0 ? "Vault unlocked and verifier secured" : "Vault unlocked");
    } catch (err) {
      wipeKeyMaterial(candidateKey);
      lockVault(false);
      setError(err instanceof Error ? err.message : "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  // ── Key pair bootstrap ─────────────────────────────────────────────────────
  const bootstrapUserKeys = async (currentKek: Uint8Array, cipher: XChaCha20Poly1305Aead) => {
    try {
      const existing = await sharingService.getMyKeys();
      if (existing.has_keys) {
        // Decrypt existing private key
        const encPriv = fromBase64(existing.encrypted_private_keys);
        const nonce = fromBase64(existing.nonce);
        const privKey = decryptPrivateKey(encPriv, nonce, currentKek, cipher);
        const pubKey = fromBase64(existing.public_key_x25519);
        setUserKeyPair(pubKey, privKey);
      } else {
        // Generate new key pair
        const kp = await generateX25519KeyPair();
        const { encryptedPrivateKey, nonce } = encryptPrivateKey(kp.privateKey, currentKek, cipher);
        await sharingService.upsertUserKeys({
          public_key_x25519: toBase64(kp.publicKey),
          encrypted_private_keys: toBase64(encryptedPrivateKey),
          nonce: toBase64(nonce),
        });
        setUserKeyPair(kp.publicKey, kp.privateKey);
      }
    } catch (err) {
      console.warn("Failed to bootstrap user keys for sharing:", err);
    }
  };

  // ── Load shared items ──────────────────────────────────────────────────────
  const loadSharedItems = useCallback(
    async (cipher: XChaCha20Poly1305Aead) => {
      if (!userPrivateKey) return;
      try {
        const resp = await sharingService.listSharedWithMe();
        const viewItems: VaultViewItem[] = [];
        for (const si of resp.items) {
          try {
            // Unwrap the DEK using X25519 ECDH
            const { unwrapDekFromShare } = await import("../../../crypto/sharing");
            // We need the sender's public key — for now we use the owner's key from lookup
            // The share was created by the item owner; we can get their public key
            // For simplicity, we'll try looking up by shared_by_email
            let senderPublicKey: Uint8Array;
            try {
              const senderKeys = await sharingService.getPublicKey(si.shared_by_email);
              senderPublicKey = fromBase64(senderKeys.public_key_x25519);
            } catch {
              // Can't get sender key, item will be corrupted
              viewItems.push({
                id: si.id,
                updatedAt: si.updated_at,
                secret: null,
                isCorrupted: true,
                vaultId: DEFAULT_SHARED_VAULT_ID,
                vaultName: "Shared",
                vaultType: "shared",
              });
              continue;
            }

            const shareDek = await unwrapDekFromShare({
              wrappedDek: fromBase64(si.share_wrapped_dek),
              wrapNonce: fromBase64(si.share_wrap_nonce),
              senderPublicKey,
              recipientPrivateKey: userPrivateKey,
              aead: cipher,
            });

            // Decrypt the item with the unwrapped DEK
            const nonce = fromBase64(si.nonce);
            const ciphertext = fromBase64(si.ciphertext);
            const plaintext = cipher.decrypt({
              key: shareDek,
              nonce,
              ciphertext,
            });
            const parsed = JSON.parse(new TextDecoder().decode(plaintext));
            viewItems.push({
              id: si.id,
              updatedAt: si.updated_at,
              secret: normalizeSecret(parsed),
              isCorrupted: false,
              vaultId: DEFAULT_SHARED_VAULT_ID,
              vaultName: `Shared by ${si.shared_by_name || si.shared_by_email}`,
              vaultType: "shared",
            });
          } catch {
            viewItems.push({
              id: si.id,
              updatedAt: si.updated_at,
              secret: null,
              isCorrupted: true,
              vaultId: DEFAULT_SHARED_VAULT_ID,
              vaultName: "Shared",
              vaultType: "shared",
            });
          }
        }
        // Merge shared items with personal items
        setItems([...items.filter((i: VaultViewItem) => i.vaultType !== "shared"), ...viewItems]);
      } catch (err) {
        console.warn("Failed to load shared items:", err);
      }
    },
    [userPrivateKey, setItems],
  );

  // Load shared items when keys are available
  useEffect(() => {
    if (aead && userPrivateKey && isKekVerified) {
      void loadSharedItems(aead);
    }
  }, [aead, userPrivateKey, isKekVerified, loadSharedItems]);

  const mapVersionToItem = useCallback((version: VaultItemVersionResponse): VaultViewItem => {
    return decryptItem({
      id: version.id,
      folder_id: version.folder_id,
      ciphertext: version.ciphertext,
      nonce: version.nonce,
      wrapped_dek: version.wrapped_dek,
      wrap_nonce: version.wrap_nonce,
      algo_version: version.algo_version,
      metadata: version.metadata,
      is_shared: false,
      version: version.version,
      created_at: version.created_at,
      updated_at: version.created_at,
      deleted_at: undefined,
    }, kek!, aead!);
  }, [aead, decryptItem, kek]);

  const refreshVaultData = useCallback(async () => {
    if (aead && kek) {
      await loadItems(kek, aead);
    }
  }, [aead, kek, loadItems]);

  const handleCreateItem = async (data: VaultItemFormData) => {
    if (!activeVault) { setError("Select a vault first"); return; }
    if (isTrashView) { setError("Restore the item from Trash before editing it."); return; }
    if (!(await ensureVerifiedWriteAccess())) return;
    if (!kek || !aead) return;

    setSaving(true);
    setError("");
    try {
      const payload = encryptVaultItem({ plaintext: JSON.stringify(data), kek, aead });
      const request = {
        folder_id: itemFolderId,
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        wrapped_dek: payload.wrappedDek,
        wrap_nonce: payload.wrapNonce,
        algo_version: payload.version,
        metadata: { kind: data.kind, vault_id: activeVault.id, vault_name: activeVault.name, vault_type: activeVault.type },
      };
      if (editingItemId) {
        await vaultService.updateItem(editingItemId, request);
      } else {
        await vaultService.createItem(request);
      }
      setDraft(DEFAULT_SECRET);
      setItemFolderId(undefined);
      setEditingItemId(null);
      setShowItemModal(false);
      await refreshVaultData();
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
      message: `Move ${item.secret?.title || "this item"} to Trash? You can restore it later.`,
      confirmLabel: "Move to Trash",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    try {
      await vaultService.deleteItem(item.id);
      if (editingItemId === item.id) { setEditingItemId(null); setDraft(DEFAULT_SECRET); }
      await refreshVaultData();
      toast.success("Vault item moved to Trash");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete vault item");
    }
  };

  const handleRestore = async (item: VaultViewItem) => {
    if (!(await ensureVerifiedWriteAccess())) return;
    if (!kek || !aead) return;

    try {
      await vaultService.restoreItem(item.id);
      await refreshVaultData();
      toast.success("Vault item restored");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to restore vault item");
    }
  };

  const handleOpenHistory = async (item: VaultViewItem) => {
    if (!aead || !kek) return;
    setHistoryItem(item);
    setHistoryVersions([]);
    setLoadingHistory(true);
    try {
      const response = await vaultService.getItemHistory(item.id);
      setHistoryVersions([item, ...response.versions.map((version) => mapVersionToItem(version))]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load item history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveVault = (data: VaultModalFormData) => {
    const name = data.name.trim();
    if (!name) { setError("Vault name is required"); return; }
    const members = normalizeMemberList(data.members || "");
    const updatedAt = new Date().toISOString();

    if (vaultModalMode === "create") {
      void (async () => {
        try {
          if (!kek || !aead) return;
          const nonce = randomBytes(aead.nonceLength);
          const ciphertext = aead.encrypt({ key: kek, nonce, plaintext: utf8ToBytes(name) });
          await vaultService.createFolder({
            name_ciphertext: toBase64(ciphertext),
            nonce: toBase64(nonce),
          });
          await refreshVaultData();
          toast.success("Folder created");
        } catch (err) {
          setError("Failed to create folder");
        }
      })();
    } else if (editingVaultId) {
      void (async () => {
         try {
          if (!kek || !aead) return;
          const nonce = randomBytes(aead.nonceLength);
          const ciphertext = aead.encrypt({ key: kek, nonce, plaintext: utf8ToBytes(name) });
          await vaultService.updateFolder(editingVaultId, {
            name_ciphertext: toBase64(ciphertext),
            nonce: toBase64(nonce),
          });
          await refreshVaultData();
          toast.success("Folder updated");
        } catch (err) {
          setError("Failed to update folder");
        }
      })();
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
    try {
      await vaultService.deleteFolder(vault.id);
      await refreshVaultData();
      toast.success("Folder deleted");
    } catch (err) {
      setError("Failed to delete folder");
    }
  };

  const handleManageMembers = (vault: VaultCardModel) => {
    void dialog.alert({ title: "Manage members", message: `Members: ${vault.members.join(", ") || "No members"}.`, confirmLabel: "Close" });
  };

  // ── Vault modal helpers ────────────────────────────────────────────────────

  const openCreateVaultModal = () => {
    setVaultModalMode("create");
    setEditingVaultId(null);
    setVaultFormInitial({ name: "", type: "personal", members: "" });
    setShowVaultModal(true);
  };

  const openEditVaultModal = (vault: VaultCardModel) => {
    setVaultModalMode("edit");
    setEditingVaultId(vault.id);
    setVaultFormInitial({ name: vault.name, type: vault.type, members: vault.members.join(", ") });
    setShowVaultModal(true);
  };

  const openCreateItemModal = () => {
    if (isTrashView) {
      setError("Trash items cannot be edited directly. Restore an item first.");
      return;
    }
    setEditingItemId(null);
    setDraft(DEFAULT_SECRET);
    if (activeVault && !activeVault.isSystem) {
      setItemFolderId(activeVault.id);
    } else {
      setItemFolderId(undefined);
    }
    setError("");
    setShowItemModal(true);
  };

  const startEdit = (item: VaultViewItem) => {
    if (!item.secret || item.isCorrupted) return;
    if (isTrashView) {
      setError("Restore the item from Trash before editing it.");
      return;
    }
    setEditingItemId(item.id);
    setDraft(item.secret);
    setItemFolderId(item.folderId);
    setError("");
    setShowItemModal(true);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setDraft(DEFAULT_SECRET);
    setItemFolderId(undefined);
    setError("");
    setShowItemModal(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!kek || !isKekVerified) {
    return (
      <VaultUnlockScreen
        unlocking={unlocking}
        aead={aead}
        error={error}
        onSubmit={handleUnlock}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        height: "calc(100vh)",
        margin: "-2rem",
        backgroundColor: "var(--color-white)",
        overflow: "hidden",
      }}
    >

      <VaultSidebar
        vaults={vaults}
        isMobile={isMobile}
        activeVaultId={activeVaultId}
        onSelectVault={setActiveVaultId}
        onCreateFolder={openCreateVaultModal}
        onEditFolder={openEditVaultModal}
        onDeleteFolder={(v) => void handleDeleteVault(v)}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "2rem",
          overflowY: "auto",
          gap: "1.5rem",
        }}
      >
        {/* Sub Header with Search and Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1.5rem",
            backgroundColor: "var(--color-white)",
            padding: "1.25rem 1.5rem",
            borderRadius: "1.25rem",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "100%" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "0.875rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-text-light)",
                  pointerEvents: "none",
                }}
              />
              <Input
                type="search"
                placeholder={isTrashView ? "Search trash" : "Search"}
                value={vaultQuery}
                onChange={(e) => setVaultQuery(e.target.value)}
                style={{ paddingLeft: "2.5rem" }}
              />
            </div>

          <div style={{ width: "12rem" }}>
            <Select
              options={[
                { value: "all", label: "All Types" },
                { value: "login", label: "Logins" },
                { value: "card", label: "Cards" },
                { value: "bank", label: "Banks" },
                { value: "note", label: "Notes" },
              ]}
              value={vaultFilter}
              onChange={(val) => setVaultFilter(val as any)}
            />
          </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexShrink: 0, alignItems: "center" }}>
            <Button
              variant="outline"
              onClick={() => lockVault()}
              style={{ gap: "0.5rem", whiteSpace: "nowrap" }}
            >
              🔒 Lock
            </Button>
            {!isTrashView && (
              <Button
                onClick={openCreateItemModal}
                style={{ gap: "0.5rem", whiteSpace: "nowrap" }}
              >
                <Plus size={18} />
                Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Tags Filter */}
        {!isTrashView && visibleItems.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ color: "var(--color-text-light)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>
              Filter by Tag:
            </div>
            {Array.from(new Set(items.filter(i => i.vaultId === activeVault?.id || i.folderId === activeVault?.id).flatMap(i => i.secret?.tags || []))).sort().map(tag => (
              <button
                key={tag}
                onClick={() => {
                  setTagFilter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                }}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.875rem",
                  borderRadius: "2rem",
                  border: "1px solid var(--color-border)",
                  background: tagFilter.includes(tag) ? "var(--color-security-blue)" : "var(--color-white)",
                  color: tagFilter.includes(tag) ? "white" : "var(--color-text-main)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "var(--shadow-sm)"
                }}
              >
                {tag}
              </button>
            ))}
             {tagFilter.length > 0 && (
               <Button variant="ghost" onClick={() => setTagFilter([])} style={{ fontSize: "0.75rem", height: "auto", padding: "0.5rem 0.875rem" }}>
                 Clear
               </Button>
            )}
          </div>
        )}

        <VaultItemsList
          items={visibleItems}
          loading={loadingItems}
          isTrashView={isTrashView}
          onRefresh={() => { void refreshVaultData(); }}
          onView={setViewingItem}
          onEdit={startEdit}
          onDelete={(item) => void handleDelete(item)}
          onRestore={(item) => void handleRestore(item)}
          onHistory={(item) => void handleOpenHistory(item)}
          onShare={(item) => setSharingItem(item)}
        />

        {showItemModal && (
          <VaultItemForm
            vaultName={activeVault?.name ?? ""}
            folders={folders}
            selectedFolderId={itemFolderId}
            initialData={draft}
            saving={saving}
            isEditing={!!editingItemId}
            error={error}
            corruptedCount={corruptedCount}
            onFolderChange={setItemFolderId}
            onSubmit={handleCreateItem}
            onClose={cancelEdit}
            allTags={allTags}
          />
        )}

        {showVaultModal && (
          <VaultModal
            mode={vaultModalMode}
            initialData={vaultFormInitial}
            onSubmit={handleSaveVault}
            onClose={() => setShowVaultModal(false)}
          />
        )}

        {viewingItem && (
          <VaultItemViewModal
            item={viewingItem}
            vaultName={activeVault?.name ?? ""}
            onClose={() => setViewingItem(null)}
            onShare={viewingItem.vaultType !== "shared" ? () => { setViewingItem(null); setSharingItem(viewingItem); } : undefined}
          />
        )}

        {historyItem && (
          <VaultItemHistoryModal
            itemTitle={historyItem.secret?.title || "Untitled"}
            versions={historyVersions}
            loading={loadingHistory}
            onClose={() => {
              setHistoryItem(null);
              setHistoryVersions([]);
            }}
          />
        )}

        {sharingItem && kek && aead && (
          <ShareItemModal
            item={sharingItem}
            kek={kek}
            aead={aead}
            userPrivateKey={userPrivateKey}
            onClose={() => setSharingItem(null)}
          />
        )}
      </div>
    </div>
  );
}
