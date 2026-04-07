/**
 * useVaultFilters — manages vault directory, active vault, filtering,
 * search (with fuzzy matching), and tag-based filtering.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../../app/providers/AuthProvider";
import { useVaultSession } from "../../../app/providers/VaultProvider";
import { searchVaultItems } from "../../../lib/fuzzy-search";

import {
  DEFAULT_PERSONAL_VAULT_ID,
  DEFAULT_SHARED_VAULT_ID,
  TRASH_VAULT_ID,
  type VaultCardModel,
  type VaultDirectoryEntry,
  type VaultFolder,
  type VaultViewItem,
} from "../vault.types";

interface UseVaultFiltersOptions {
  folders: VaultFolder[];
  trashedItems: VaultViewItem[];
}

export function useVaultFilters({ folders, trashedItems }: UseVaultFiltersOptions) {
  const { session } = useAuth();
  const { items } = useVaultSession();

  // ── State ─────────────────────────────────────────────────────────────
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [vaultFilter, setVaultFilter] = useState<string>("all");
  const [vaultQuery, setVaultQuery] = useState("");
  const [activeVaultId, setActiveVaultId] = useState(DEFAULT_PERSONAL_VAULT_ID);
  const [vaultDirectory, setVaultDirectory] = useState<VaultDirectoryEntry[]>([]);

  // ── Vault directory (sidebar) ─────────────────────────────────────────

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

  // ── Derived vault cards ───────────────────────────────────────────────

  const vaults = useMemo(() => {
    const list: VaultCardModel[] = [
      {
        id: DEFAULT_PERSONAL_VAULT_ID, name: "Personal Vault", type: "personal",
        members: [session?.name?.trim() || "You"], updatedAt: new Date().toISOString(),
        isSystem: true, itemCount: 0,
      },
      {
        id: DEFAULT_SHARED_VAULT_ID, name: "Family Shared Vault", type: "shared",
        members: [session?.name?.trim() || "You", "Family"], updatedAt: new Date().toISOString(),
        isSystem: true, itemCount: 0,
      },
      {
        id: TRASH_VAULT_ID, name: "Trash", type: "personal",
        members: [session?.name?.trim() || "You"], updatedAt: new Date().toISOString(),
        isSystem: true, itemCount: trashedItems.length,
      },
    ];

    for (const f of folders) {
      list.push({
        id: f.id, name: f.name, type: "personal",
        members: [session?.name?.trim() || "You"], updatedAt: f.updatedAt,
        isSystem: false, itemCount: 0,
      });
    }

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

  const activeVault = useMemo(
    () => vaults.find((v) => v.id === activeVaultId) ?? vaults[0] ?? null,
    [activeVaultId, vaults],
  );

  const isTrashView = activeVault?.id === TRASH_VAULT_ID;

  // ── Filtered items ────────────────────────────────────────────────────

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach((item) => {
      item.secret?.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [items]);

  const visibleItems = useMemo(() => {
    if (!activeVault) return [];
    let filtered = isTrashView
      ? [...trashedItems]
      : items.filter((i) => i.vaultId === activeVault.id);

    // Filter by selected folder
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

    // Filter by item type dropdown
    if (vaultFilter !== "all") {
      filtered = filtered.filter((i) => i.secret?.kind === vaultFilter);
    }

    // Fuzzy search (replaces the old simple `includes()`)
    const q = vaultQuery.trim();
    if (q) {
      filtered = searchVaultItems(q, filtered);
    }

    return filtered;
  }, [activeVault, isTrashView, items, selectedFolderId, tagFilter, trashedItems, vaultFilter, vaultQuery]);

  const corruptedCount = useMemo(
    () => visibleItems.filter((i) => i.isCorrupted).length,
    [visibleItems],
  );

  // ── Reset on lock ────────────────────────────────────────────────────

  const resetFilterState = useCallback(() => {
    setSelectedFolderId(undefined);
    setTagFilter([]);
    setVaultFilter("all");
    setVaultQuery("");
  }, []);

  return {
    // Vault directory
    vaults,
    activeVaultId,
    setActiveVaultId,
    activeVault,
    isTrashView,

    // Filters
    selectedFolderId,
    setSelectedFolderId,
    tagFilter,
    setTagFilter,
    vaultFilter,
    setVaultFilter,
    vaultQuery,
    setVaultQuery,

    // Derived
    allTags,
    visibleItems,
    corruptedCount,

    // Reset
    resetFilterState,
  };
}
