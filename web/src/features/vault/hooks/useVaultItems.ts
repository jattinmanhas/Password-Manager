/**
 * useVaultItems — manages vault items CRUD, decryption, shared items,
 * folders, history, and item form state.
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useAuth } from "../../../app/providers/AuthProvider";
import { useDialog } from "../../../app/providers/DialogProvider";
import { useVaultSession } from "../../../app/providers/VaultProvider";
import { ApiError } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/error-codes";
import {
  decryptVaultItem,
  encryptVaultItem,
  fromBase64,
  toBase64,
  utf8ToBytes,
  bytesToUtf8,
  randomBytes,
} from "../../../crypto";
import type { XChaCha20Poly1305Aead } from "../../../crypto";
import { decryptVaultItemsWithWorker } from "../../../crypto/worker-client";
import { vaultService } from "../services/vault.service";
import { sharingService } from "../services/sharing.service";
import type { FolderResponse, VaultItemResponse, VaultItemVersionResponse } from "../types";

import {
  DEFAULT_SECRET,
  DEFAULT_SHARED_VAULT_ID,
  type VaultCardModel,
  type VaultFolder,
  type VaultSecret,
  type VaultViewItem,
} from "../vault.types";
import {
  getVaultReference,
  isVerifierItem,
  normalizeSecret,
} from "../vault.utils";

import type { VaultItemFormData, VaultModalFormData } from "../../../lib/validations/vault";

// ── Hook ────────────────────────────────────────────────────────────────────

interface UseVaultItemsOptions {
  ensureVerifiedWriteAccess: () => Promise<boolean>;
}

export function useVaultItems({ ensureVerifiedWriteAccess }: UseVaultItemsOptions) {
  const { session } = useAuth();
  const dialog = useDialog();
  const {
    aead,
    kek,
    isKekVerified,
    items,
    userPrivateKey,
    setItems,
  } = useVaultSession();

  // ── UI State ────────────────────────────────────────────────────────────
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");
  const [folders, setFolders] = useState<VaultFolder[]>([]);
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

  // ── Decrypt helpers ─────────────────────────────────────────────────────

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
        const plaintext = cipher.decrypt({ key, nonce: nonceBytes, ciphertext: ciphertextBytes });
        return { id: f.id, name: bytesToUtf8(plaintext), updatedAt: f.updated_at };
      } catch {
        return { id: f.id, name: "Corrupted Folder", updatedAt: f.updated_at };
      }
    },
    [],
  );

  // ── Load items ──────────────────────────────────────────────────────────

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

        setFolders(foldersResp.folders.map((f) => decryptFolder(f, key, cipher)));
        const [activeItems, deletedItems] = await Promise.all([
          decryptVaultItemsWithWorker({ items: all.filter((i) => !isVerifierItem(i)), kek: key }),
          decryptVaultItemsWithWorker({ items: trashResp.items, kek: key }),
        ]);
        setItems(activeItems);
        setTrashedItems(deletedItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load vault items");
      } finally {
        setLoadingItems(false);
      }
    },
    [decryptFolder, setItems],
  );

  const refreshVaultData = useCallback(async () => {
    if (aead && kek) await loadItems(kek, aead);
  }, [aead, kek, loadItems]);

  // ── Shared items ────────────────────────────────────────────────────────

  const loadSharedItems = useCallback(
    async (cipher: XChaCha20Poly1305Aead) => {
      if (!userPrivateKey) return;
      try {
        const resp = await sharingService.listSharedWithMe();
        const viewItems: VaultViewItem[] = [];
        for (const si of resp.items) {
          try {
            const { unwrapDekFromShare } = await import("../../../crypto/sharing");
            let senderPublicKey: Uint8Array;
            try {
              const senderKeys = await sharingService.getPublicKey(si.shared_by_email);
              senderPublicKey = fromBase64(senderKeys.public_key_x25519);
            } catch {
              viewItems.push({
                id: si.id, updatedAt: si.updated_at, secret: null, isCorrupted: true,
                vaultId: DEFAULT_SHARED_VAULT_ID, vaultName: "Shared", vaultType: "shared",
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
            const nonce = fromBase64(si.nonce);
            const ciphertext = fromBase64(si.ciphertext);
            const plaintext = cipher.decrypt({ key: shareDek, nonce, ciphertext });
            const parsed = JSON.parse(new TextDecoder().decode(plaintext));
            viewItems.push({
              id: si.id, updatedAt: si.updated_at, secret: normalizeSecret(parsed),
              isCorrupted: false, vaultId: DEFAULT_SHARED_VAULT_ID,
              vaultName: `Shared by ${si.shared_by_name || si.shared_by_email}`, vaultType: "shared",
            });
          } catch {
            viewItems.push({
              id: si.id, updatedAt: si.updated_at, secret: null, isCorrupted: true,
              vaultId: DEFAULT_SHARED_VAULT_ID, vaultName: "Shared", vaultType: "shared",
            });
          }
        }
        setItems([...items.filter((i: VaultViewItem) => i.vaultType !== "shared"), ...viewItems]);
      } catch (err) {
        console.warn("Failed to load shared items:", err);
      }
    },
    [userPrivateKey, setItems],
  );

  useEffect(() => {
    if (aead && userPrivateKey && isKekVerified) {
      void loadSharedItems(aead);
    }
  }, [aead, userPrivateKey, isKekVerified, loadSharedItems]);

  // ── History ─────────────────────────────────────────────────────────────

  const mapVersionToItem = useCallback(
    (version: VaultItemVersionResponse): VaultViewItem => {
      return decryptItem(
        {
          id: version.id, folder_id: version.folder_id,
          ciphertext: version.ciphertext, nonce: version.nonce,
          wrapped_dek: version.wrapped_dek, wrap_nonce: version.wrap_nonce,
          algo_version: version.algo_version, metadata: version.metadata,
          is_shared: false, version: version.version,
          created_at: version.created_at, updated_at: version.created_at,
          deleted_at: undefined,
        },
        kek!,
        aead!,
      );
    },
    [aead, decryptItem, kek],
  );

  const handleOpenHistory = useCallback(
    async (item: VaultViewItem) => {
      if (!aead || !kek) return;
      setHistoryItem(item);
      setHistoryVersions([]);
      setLoadingHistory(true);
      try {
        const response = await vaultService.getItemHistory(item.id);
        setHistoryVersions([item, ...response.versions.map((v) => mapVersionToItem(v))]);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load item history"));
      } finally {
        setLoadingHistory(false);
      }
    },
    [aead, kek, mapVersionToItem],
  );

  // ── CRUD handlers ─────────────────────────────────────────────────────

  const handleCreateItem = useCallback(
    async (data: VaultItemFormData, activeVault: VaultCardModel | null, isTrashView: boolean) => {
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
        setError(getErrorMessage(err, "Failed to save vault item"));
      } finally {
        setSaving(false);
      }
    },
    [aead, editingItemId, ensureVerifiedWriteAccess, itemFolderId, kek, refreshVaultData],
  );

  const handleDelete = useCallback(
    async (item: VaultViewItem) => {
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
        setError(getErrorMessage(err, "Failed to delete vault item"));
      }
    },
    [aead, dialog, editingItemId, ensureVerifiedWriteAccess, kek, refreshVaultData],
  );

  const handleRestore = useCallback(
    async (item: VaultViewItem) => {
      if (!(await ensureVerifiedWriteAccess())) return;
      try {
        await vaultService.restoreItem(item.id);
        await refreshVaultData();
        toast.success("Vault item restored");
      } catch (err) {
        setError(getErrorMessage(err, "Failed to restore vault item"));
      }
    },
    [ensureVerifiedWriteAccess, refreshVaultData],
  );

  // ── Folder CRUD ────────────────────────────────────────────────────────

  const handleSaveVault = useCallback(
    (
      data: VaultModalFormData,
      vaultModalMode: "create" | "edit",
      editingVaultId: string | null,
    ) => {
      const name = data.name.trim();
      if (!name) { setError("Vault name is required"); return; }

      if (vaultModalMode === "create") {
        void (async () => {
          try {
            if (!kek || !aead) return;
            const nonce = randomBytes(aead.nonceLength);
            const ciphertext = aead.encrypt({ key: kek, nonce, plaintext: utf8ToBytes(name) });
            await vaultService.createFolder({ name_ciphertext: toBase64(ciphertext), nonce: toBase64(nonce) });
            await refreshVaultData();
            toast.success("Folder created");
          } catch {
            setError("Failed to create folder");
          }
        })();
      } else if (editingVaultId) {
        void (async () => {
          try {
            if (!kek || !aead) return;
            const nonce = randomBytes(aead.nonceLength);
            const ciphertext = aead.encrypt({ key: kek, nonce, plaintext: utf8ToBytes(name) });
            await vaultService.updateFolder(editingVaultId, { name_ciphertext: toBase64(ciphertext), nonce: toBase64(nonce) });
            await refreshVaultData();
            toast.success("Folder updated");
          } catch {
            setError("Failed to update folder");
          }
        })();
      }
    },
    [aead, kek, refreshVaultData],
  );

  const handleDeleteVault = useCallback(
    async (vault: VaultCardModel) => {
      if (vault.isSystem) {
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
      } catch {
        setError("Failed to delete folder");
      }
    },
    [dialog, refreshVaultData],
  );

  // ── Lock reset helpers ────────────────────────────────────────────────

  const resetItemState = useCallback(() => {
    setEditingItemId(null);
    setDraft(DEFAULT_SECRET);
    setItemFolderId(undefined);
    setFolders([]);
    setTrashedItems([]);
    setViewingItem(null);
    setHistoryItem(null);
    setHistoryVersions([]);
  }, []);

  return {
    // State
    loadingItems,
    error,
    setError,
    folders,
    draft,
    setDraft,
    saving,
    editingItemId,
    setEditingItemId,
    showItemModal,
    setShowItemModal,
    viewingItem,
    setViewingItem,
    itemFolderId,
    setItemFolderId,
    sharingItem,
    setSharingItem,
    trashedItems,
    historyItem,
    setHistoryItem,
    historyVersions,
    setHistoryVersions,
    loadingHistory,

    // Handlers
    loadItems,
    refreshVaultData,
    handleCreateItem,
    handleDelete,
    handleRestore,
    handleOpenHistory,
    handleSaveVault,
    handleDeleteVault,
    resetItemState,
  };
}
