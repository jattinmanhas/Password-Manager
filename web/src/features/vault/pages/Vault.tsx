import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useDialog } from "../../../app/providers/DialogProvider";
import { useVaultSession } from "../../../app/providers/VaultProvider";

import { useVaultUnlock } from "../hooks/useVaultUnlock";
import { useVaultItems } from "../hooks/useVaultItems";
import { useVaultFilters } from "../hooks/useVaultFilters";

import {
  DEFAULT_SECRET,
  type VaultCardModel,
  type VaultViewItem,
} from "../vault.types";
import {
  normalizeMemberList,
} from "../vault.utils";

import { VaultUnlockScreen } from "../components/VaultUnlockScreen";
import { VaultSidebar } from "../components/VaultSidebar";
import { VaultItemForm } from "../components/VaultItemForm";
import { VaultItemHistoryModal } from "../components/VaultItemHistoryModal";
import { VaultItemsList } from "../components/VaultItemsList";
import { VaultModal } from "../components/VaultModal";
import { VaultItemViewModal } from "../components/VaultItemViewModal";
import { ShareItemModal } from "../components/ShareItemModal";
import { Search, Plus } from "lucide-react";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";

import type { VaultModalFormData, VaultItemFormData } from "../../../lib/validations/vault";

export function Vault() {
  const { session } = useAuth();
  const dialog = useDialog();
  const { aead, kek, isKekVerified } = useVaultSession();

  // ── Vault modal state (local to this component) ──────────────────────
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

  const handleManageMembers = (vault: VaultCardModel) => {
    void dialog.alert({ title: "Manage members", message: `Members: ${vault.members.join(", ") || "No members"}.`, confirmLabel: "Close" });
  };

  // ── Combined error from both hooks ───────────────────────────────────
  const error = unlockHook.error || itemsHook.error;

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
        vaults={filtersHook.vaults}
        isMobile={isMobile}
        activeVaultId={filtersHook.activeVaultId}
        onSelectVault={filtersHook.setActiveVaultId}
        onCreateFolder={openCreateVaultModal}
        onEditFolder={openEditVaultModal}
        onDeleteFolder={(v) => void itemsHook.handleDeleteVault(v)}
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
                placeholder={filtersHook.isTrashView ? "Search trash" : "Search (try user: or url:)"}
                value={filtersHook.vaultQuery}
                onChange={(e) => filtersHook.setVaultQuery(e.target.value)}
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
              value={filtersHook.vaultFilter}
              onChange={(val) => filtersHook.setVaultFilter(val as any)}
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
            {!filtersHook.isTrashView && (
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
        {!filtersHook.isTrashView && filtersHook.visibleItems.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ color: "var(--color-text-light)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>
              Filter by Tag:
            </div>
            {Array.from(new Set(
              filtersHook.visibleItems.flatMap((i) => i.secret?.tags || [])
            )).sort().map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  filtersHook.setTagFilter((prev) =>
                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
                  );
                }}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.875rem",
                  borderRadius: "2rem",
                  border: "1px solid var(--color-border)",
                  background: filtersHook.tagFilter.includes(tag) ? "var(--color-security-blue)" : "var(--color-white)",
                  color: filtersHook.tagFilter.includes(tag) ? "white" : "var(--color-text-main)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {tag}
              </button>
            ))}
             {filtersHook.tagFilter.length > 0 && (
               <Button variant="ghost" onClick={() => filtersHook.setTagFilter([])} style={{ fontSize: "0.75rem", height: "auto", padding: "0.5rem 0.875rem" }}>
                 Clear
               </Button>
            )}
          </div>
        )}

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
            userPrivateKey={useVaultSession().userPrivateKey}
            onClose={() => itemsHook.setSharingItem(null)}
          />
        )}
      </div>
    </div>
  );
}
