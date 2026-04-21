import { useCallback, useState } from "react";
import { useVaultSession } from "../../../app/providers/VaultProvider";

import { useVaultUnlock } from "../hooks/useVaultUnlock";
import { useVaultItems } from "../hooks/useVaultItems";
import { useVaultFilters } from "../hooks/useVaultFilters";

import {
  DEFAULT_SECRET,
  type VaultCardModel,
  type VaultViewItem,
} from "../vault.types";

import { VaultUnlockScreen } from "../components/VaultUnlockScreen";
import { VaultSidebar } from "../components/VaultSidebar";
import { VaultItemForm } from "../components/VaultItemForm";
import { VaultItemHistoryModal } from "../components/VaultItemHistoryModal";
import { VaultItemsList } from "../components/VaultItemsList";
import { VaultModal } from "../components/VaultModal";
import { VaultItemViewModal } from "../components/VaultItemViewModal";
import { ShareItemModal } from "../components/ShareItemModal";
import { Search, Plus, Lock as LockIcon } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";

import type { VaultModalFormData, VaultItemFormData } from "../../../lib/validations/vault";

export function Vault() {
  const { aead, kek, isKekVerified, userPrivateKey } = useVaultSession();

  // ── Vault modal state (local to this component) ──────────────────────
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [vaultModalMode, setVaultModalMode] = useState<"create" | "edit">("create");
  const [vaultFormInitial, setVaultFormInitial] = useState<VaultModalFormData>({ name: "", type: "personal", members: "" });
  const [editingVaultId, setEditingVaultId] = useState<string | null>(null);

  // ── Compose hooks ────────────────────────────────────────────────────

  const itemsHook = useVaultItems({
    ensureVerifiedWriteAccess: async () => {
      // Delegate to unlock hook (set after init)
      return unlockHook.ensureVerifiedWriteAccess();
    },
  });

  const unlockHook = useVaultUnlock({
    onUnlocked: async (derivedKek, cipher, prefetchedItems) => {
      await itemsHook.loadItems(derivedKek, cipher, prefetchedItems);
    },
  });

  const filtersHook = useVaultFilters({
    folders: itemsHook.folders,
    trashedItems: itemsHook.trashedItems,
  });

  // ── Lock vault (combines all resets) ─────────────────────────────────

  const lockVault = useCallback(() => {
    unlockHook.lockVault();
    itemsHook.resetItemState();
    filtersHook.resetFilterState();
  }, [unlockHook, itemsHook, filtersHook]);

  // ── Vault modal helpers ──────────────────────────────────────────────

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
    if (filtersHook.isTrashView) {
      unlockHook.setError("Trash items cannot be edited directly. Restore an item first.");
      return;
    }
    itemsHook.setEditingItemId(null);
    itemsHook.setDraft(DEFAULT_SECRET);
    if (filtersHook.activeVault && !filtersHook.activeVault.isSystem) {
      itemsHook.setItemFolderId(filtersHook.activeVault.id);
    } else {
      itemsHook.setItemFolderId(undefined);
    }
    unlockHook.setError("");
    itemsHook.setShowItemModal(true);
  };

  const startEdit = (item: VaultViewItem) => {
    if (!item.secret || item.isCorrupted) return;
    if (filtersHook.isTrashView) {
      unlockHook.setError("Restore the item from Trash before editing it.");
      return;
    }
    itemsHook.setEditingItemId(item.id);
    itemsHook.setDraft(item.secret);
    itemsHook.setItemFolderId(item.folderId);
    unlockHook.setError("");
    itemsHook.setShowItemModal(true);
  };

  const cancelEdit = () => {
    itemsHook.setEditingItemId(null);
    itemsHook.setDraft(DEFAULT_SECRET);
    itemsHook.setItemFolderId(undefined);
    unlockHook.setError("");
    itemsHook.setShowItemModal(false);
  };

  // ── Combined error from both hooks ───────────────────────────────────
  const error = unlockHook.error || itemsHook.error;
  const visibleTagOptions = Array.from(
    new Set(filtersHook.visibleItems.flatMap((item) => item.secret?.tags || []))
  ).sort();

  // ── Render ───────────────────────────────────────────────────────────

  if (!kek || !isKekVerified) {
    return (
      <VaultUnlockScreen
        unlocking={unlockHook.unlocking}
        aead={aead}
        error={error}
        mode={unlockHook.unlockMode}
        onSubmit={unlockHook.handleUnlock}
      />
    );
  }

  return (
    <div className="vault-layout">
      <VaultSidebar
        vaults={filtersHook.vaults}
        activeVaultId={filtersHook.activeVaultId}
        onSelectVault={filtersHook.setActiveVaultId}
        onCreateFolder={openCreateVaultModal}
        onEditFolder={openEditVaultModal}
        onDeleteFolder={(v) => void itemsHook.handleDeleteVault(v)}
      />

      <div className="vault-main">
        {/* ── Row 1: Dedicated Search ────────────────────── */}
        <div className="vault-top-search">
          <div className="vault-search-row">
            <Search size={20} className="vault-search-icon" />
            <Input
              type="search"
              placeholder={filtersHook.isTrashView ? "Search trash archive…" : "Search credentials, accounts, or sites…"}
              value={filtersHook.vaultQuery}
              onChange={(e) => filtersHook.setVaultQuery(e.target.value)}
              className="vault-search-input"
            />
          </div>
        </div>

        {/* ── Row 2: Secondary Filters & Actions ────────── */}
        <div className="vault-actions-row">
          <div className="vault-type-select">
            <Select
              options={[
                { value: "all", label: "All Items" },
                { value: "login", label: "Logins" },
                { value: "card", label: "Payment Cards" },
                { value: "bank", label: "Bank Accounts" },
                { value: "note", label: "Secure Notes" },
              ]}
              value={filtersHook.vaultFilter}
              onChange={(val) => filtersHook.setVaultFilter(val as any)}
            />
          </div>

          <div className="vault-actions-group">
            <Button
              variant="outline"
              onClick={() => lockVault()}
              className="vault-action-button"
              style={{ gap: "0.5rem" }}
            >
              <LockIcon size={16} />
              Lock
            </Button>
            {!filtersHook.isTrashView && (
              <Button
                onClick={openCreateItemModal}
                className="vault-action-button"
                style={{ gap: "0.5rem" }}
              >
                <Plus size={16} />
                Add Item
              </Button>
            )}
          </div>
        </div>

        {/* ── Row 3: Tag Filtering ───────────────────────── */}
        {visibleTagOptions.length > 0 && !filtersHook.isTrashView && (
          <div className="vault-tags-row">
            <div className="vault-tags-bar">
              <span className="vault-tags-label">Filter by Tags:</span>
              <div className="vault-tags-scroll">
                {visibleTagOptions.map((tag) => (
                  <button
                    key={tag}
                    className="vault-tag-pill"
                    data-active={filtersHook.tagFilter.includes(tag)}
                    onClick={() => {
                      filtersHook.setTagFilter((prev) =>
                        prev.includes(tag)
                          ? prev.filter((t) => t !== tag)
                          : [...prev, tag]
                      );
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {filtersHook.tagFilter.length > 0 && (
                <button
                  className="vault-tags-clear"
                  onClick={() => filtersHook.setTagFilter([])}
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Items List ──────────────────────────────────── */}
        <VaultItemsList
          items={filtersHook.visibleItems}
          loading={itemsHook.loadingItems}
          isTrashView={filtersHook.isTrashView}
          onRefresh={() => { void itemsHook.refreshVaultData(); }}
          onView={itemsHook.setViewingItem}
          onEdit={startEdit}
          onDelete={(item) => void itemsHook.handleDelete(item)}
          onRestore={(item) => void itemsHook.handleRestore(item)}
          onHistory={(item) => void itemsHook.handleOpenHistory(item)}
          onShare={(item) => itemsHook.setSharingItem(item)}
        />

        {/* ── Modals ──────────────────────────────────────── */}
        {itemsHook.showItemModal && (
          <VaultItemForm
            vaultName={filtersHook.activeVault?.name ?? ""}
            folders={itemsHook.folders}
            selectedFolderId={itemsHook.itemFolderId}
            initialData={itemsHook.draft}
            saving={itemsHook.saving}
            isEditing={!!itemsHook.editingItemId}
            error={error}
            corruptedCount={filtersHook.corruptedCount}
            onFolderChange={itemsHook.setItemFolderId}
            onSubmit={(data: VaultItemFormData) =>
              itemsHook.handleCreateItem(data, filtersHook.activeVault, filtersHook.isTrashView)
            }
            onClose={cancelEdit}
            allTags={filtersHook.allTags}
          />
        )}

        {showVaultModal && (
          <VaultModal
            mode={vaultModalMode}
            initialData={vaultFormInitial}
            onSubmit={(data) => {
              itemsHook.handleSaveVault(data, vaultModalMode, editingVaultId);
              setShowVaultModal(false);
            }}
            onClose={() => setShowVaultModal(false)}
          />
        )}

        {itemsHook.viewingItem && (
          <VaultItemViewModal
            item={itemsHook.viewingItem}
            vaultName={filtersHook.activeVault?.name ?? ""}
            onClose={() => itemsHook.setViewingItem(null)}
            onShare={
              itemsHook.viewingItem.vaultType !== "shared"
                ? () => {
                    itemsHook.setSharingItem(itemsHook.viewingItem);
                    itemsHook.setViewingItem(null);
                  }
                : undefined
            }
          />
        )}

        {itemsHook.historyItem && (
          <VaultItemHistoryModal
            itemTitle={itemsHook.historyItem.secret?.title || "Untitled"}
            versions={itemsHook.historyVersions}
            loading={itemsHook.loadingHistory}
            onClose={() => {
              itemsHook.setHistoryItem(null);
              itemsHook.setHistoryVersions([]);
            }}
          />
        )}

        {itemsHook.sharingItem && kek && aead && (
          <ShareItemModal
            item={itemsHook.sharingItem}
            kek={kek}
            aead={aead}
            userPrivateKey={userPrivateKey}
            onClose={() => itemsHook.setSharingItem(null)}
          />
        )}
      </div>
    </div>
  );
}
