import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FolderLock, Lock, Search, Settings, Share2, Trash2 } from "lucide-react";

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
  utf8ToBytes,
} from "../../../crypto";
import { createDefaultArgon2idKdf, createDefaultXChaCha20Poly1305 } from "../../../crypto/adapters";
import type { XChaCha20Poly1305Aead } from "../../../crypto";
import { vaultService } from "../services/vault.service";
import type { VaultItemResponse } from "../types";

type VaultType = "personal" | "shared";
type VaultFilter = "all" | VaultType;

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
  vaultId: string;
  vaultName: string;
  vaultType: VaultType;
}

interface VaultDirectoryEntry {
  id: string;
  name: string;
  type: VaultType;
  members: string[];
  updatedAt: string;
  isSystem: boolean;
}

interface VaultCardModel extends VaultDirectoryEntry {
  itemCount: number;
}

interface VaultMetadata {
  kind?: string;
  vault_id?: string;
  vault_name?: string;
  vault_type?: VaultType;
  salt?: string;
}

const DEFAULT_SECRET: VaultSecret = {
  title: "",
  username: "",
  password: "",
  notes: "",
};

const DEFAULT_PERSONAL_VAULT_ID = "personal-main";
const DEFAULT_SHARED_VAULT_ID = "shared-family";

const KEK_VERIFIER_KIND = "kek-verifier";
const KEK_VERIFIER_TOKEN = "pmv2-kek-verifier-v1";
const KEK_VERIFIER_TOKEN_BYTES = utf8ToBytes(KEK_VERIFIER_TOKEN);
const MASTER_KEY_SALT_LENGTH = 16;
const LEGACY_SALT_STORAGE_PREFIX = "pmv2:vault-salt:";

function asObject(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  return input as Record<string, unknown>;
}

function normalizeSecret(input: unknown): VaultSecret {
  const value = asObject(input);
  if (!value) {
    return DEFAULT_SECRET;
  }

  return {
    title: typeof value.title === "string" ? value.title : "",
    username: typeof value.username === "string" ? value.username : "",
    password: typeof value.password === "string" ? value.password : "",
    notes: typeof value.notes === "string" ? value.notes : "",
  };
}

function normalizeVaultType(input: unknown): VaultType {
  return input === "shared" ? "shared" : "personal";
}

function parseVaultMetadata(metadata: unknown): VaultMetadata {
  const value = asObject(metadata);
  if (!value) {
    return {};
  }

  return {
    kind: typeof value.kind === "string" ? value.kind : undefined,
    vault_id: typeof value.vault_id === "string" ? value.vault_id : undefined,
    vault_name: typeof value.vault_name === "string" ? value.vault_name : undefined,
    vault_type: normalizeVaultType(value.vault_type),
    salt: typeof value.salt === "string" ? value.salt : undefined,
  };
}

function getVaultReference(metadata: unknown): { vaultId: string; vaultName: string; vaultType: VaultType } {
  const parsed = parseVaultMetadata(metadata);
  return {
    vaultId: parsed.vault_id ?? DEFAULT_PERSONAL_VAULT_ID,
    vaultName: parsed.vault_name ?? "Personal Vault",
    vaultType: parsed.vault_type ?? "personal",
  };
}

function getVerifierSalt(item: VaultItemResponse): Uint8Array | null {
  const metadata = parseVaultMetadata(item.metadata);
  if (metadata.kind !== KEK_VERIFIER_KIND || !metadata.salt) {
    return null;
  }

  try {
    const decoded = fromBase64(metadata.salt);
    return decoded.length === MASTER_KEY_SALT_LENGTH ? decoded : null;
  } catch {
    return null;
  }
}

function isVerifierItem(item: VaultItemResponse): boolean {
  return parseVaultMetadata(item.metadata).kind === KEK_VERIFIER_KIND;
}

function buildVaultId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const entropy = toBase64(randomBytes(6)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  return `vault-${slug || "new"}-${entropy}`;
}

function normalizeMemberList(raw: string): string[] {
  const members = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return members.slice(0, 8);
}

function constantTimeEquals(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

function wipeKeyMaterial(key: Uint8Array | null | undefined): void {
  if (key) {
    key.fill(0);
  }
}

export function Vault() {
  const { session } = useAuth();
  const dialog = useDialog();

  const [aead, setAead] = useState<XChaCha20Poly1305Aead | null>(null);
  const [kek, setKek] = useState<Uint8Array | null>(null);
  const [isKekVerified, setIsKekVerified] = useState(false);
  const [verifierItem, setVerifierItem] = useState<VaultItemResponse | null>(null);

  const [masterPassword, setMasterPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const [items, setItems] = useState<VaultViewItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState<VaultSecret>(DEFAULT_SECRET);
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [vaultFilter, setVaultFilter] = useState<VaultFilter>("all");
  const [vaultQuery, setVaultQuery] = useState("");
  const [activeVaultId, setActiveVaultId] = useState(DEFAULT_PERSONAL_VAULT_ID);

  const [showVaultModal, setShowVaultModal] = useState(false);
  const [vaultModalMode, setVaultModalMode] = useState<"create" | "edit">("create");
  const [vaultForm, setVaultForm] = useState({
    name: "",
    type: "personal" as VaultType,
    members: "",
  });
  const [editingVaultId, setEditingVaultId] = useState<string | null>(null);

  const [vaultDirectory, setVaultDirectory] = useState<VaultDirectoryEntry[]>([]);

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
    if (clearError) {
      setError("");
    }
  }, []);

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
    const now = new Date().toISOString();
    const displayName = session?.name?.trim() || "You";

    lockVault();
    setMasterPassword("");
    setActiveVaultId(DEFAULT_PERSONAL_VAULT_ID);
    setVaultDirectory([
      {
        id: DEFAULT_PERSONAL_VAULT_ID,
        name: "Personal Vault",
        type: "personal",
        members: [displayName],
        updatedAt: now,
        isSystem: true,
      },
      {
        id: DEFAULT_SHARED_VAULT_ID,
        name: "Family Shared Vault",
        type: "shared",
        members: [displayName, "Family"],
        updatedAt: now,
        isSystem: true,
      },
    ]);
  }, [lockVault, session?.userId, session?.name]);

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

        const parsed = JSON.parse(plaintext);
        return {
          id: item.id,
          updatedAt: item.updated_at,
          secret: normalizeSecret(parsed),
          isCorrupted: false,
          vaultId: vaultRef.vaultId,
          vaultName: vaultRef.vaultName,
          vaultType: vaultRef.vaultType,
        };
      } catch {
        return {
          id: item.id,
          updatedAt: item.updated_at,
          secret: null,
          isCorrupted: true,
          vaultId: vaultRef.vaultId,
          vaultName: vaultRef.vaultName,
          vaultType: vaultRef.vaultType,
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
        return constantTimeEquals(utf8ToBytes(token), KEK_VERIFIER_TOKEN_BYTES);
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
        const itemsResponse = sourceItems ?? (await vaultService.listItems()).items;
        const verifierItems = itemsResponse.filter((item) => isVerifierItem(item));
        if (verifierItems.length > 1) {
          throw new Error("Multiple vault verifiers detected. Vault recovery is required.");
        }

        setVerifierItem(verifierItems[0] ?? null);

        const nextItems = itemsResponse
          .filter((item) => !isVerifierItem(item))
          .map((item) => decryptItem(item, key, cipher));

        setItems(nextItems);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
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

  const upsertVerifierItem = useCallback(
    async (key: Uint8Array, salt: Uint8Array, cipher: XChaCha20Poly1305Aead, existing: VaultItemResponse | null) => {
      const payload = encryptVaultItem({
        plaintext: KEK_VERIFIER_TOKEN,
        kek: key,
        aead: cipher,
      });

      const request = {
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        wrapped_dek: payload.wrappedDek,
        wrap_nonce: payload.wrapNonce,
        algo_version: payload.version,
        metadata: {
          kind: KEK_VERIFIER_KIND,
          salt: toBase64(salt),
        },
      };

      if (existing) {
        return vaultService.updateItem(existing.id, request);
      }
      return vaultService.createItem(request);
    },
    [],
  );

  const ensureVerifiedWriteAccess = useCallback(async () => {
    if (!kek || !aead || !isKekVerified || !verifierItem) {
      setError("Unlock the vault with a valid passphrase before making changes.");
      return false;
    }

    const stillValid = verifyKek(verifierItem, kek, aead);
    if (!stillValid) {
      lockVault(false);
      setError("Vault key verification failed. Please unlock again.");
      return false;
    }

    return true;
  }, [aead, isKekVerified, kek, lockVault, verifierItem, verifyKek]);

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault();

    if (!session || !aead || unlocking) {
      return;
    }

    const passwordInput = masterPassword;
    setMasterPassword("");

    if (!passwordInput.trim()) {
      setError("Vault passphrase is required");
      return;
    }

    setError("");
    setUnlocking(true);

    let candidateKey: Uint8Array | null = null;

    try {
      const listedItems = await vaultService.listItems();
      const allItems = listedItems.items;
      const verifierItems = allItems.filter((item) => isVerifierItem(item));
      if (verifierItems.length > 1) {
        throw new Error("Multiple vault verifiers detected. Vault recovery is required.");
      }
      const existingVerifier = verifierItems[0] ?? null;

      const kdf = await createDefaultArgon2idKdf();

      if (existingVerifier) {
        const salt = getVerifierSalt(existingVerifier);
        if (!salt) {
          throw new Error("Vault verifier is invalid. Please contact support.");
        }

        const derived = await deriveMasterKey({
          password: passwordInput,
          kdf,
          salt,
        });
        candidateKey = derived.key;

        if (!verifyKek(existingVerifier, candidateKey, aead)) {
          throw new Error("Incorrect vault passphrase");
        }

        setKek(candidateKey);
        candidateKey = null;
        setIsKekVerified(true);
        setVerifierItem(existingVerifier);
        await loadItems(derived.key, aead, allItems);
        toast.success("Vault unlocked");
        return;
      }

      const legacyStorageKey = `${LEGACY_SALT_STORAGE_PREFIX}${session.userId}`;
      let legacySalt: Uint8Array | null = null;

      if (typeof window !== "undefined") {
        const storedLegacySalt = window.localStorage.getItem(legacyStorageKey);
        if (storedLegacySalt) {
          try {
            const decoded = fromBase64(storedLegacySalt);
            legacySalt = decoded.length === MASTER_KEY_SALT_LENGTH ? decoded : null;
          } catch {
            legacySalt = null;
          }
        }
      }

      const encryptedDataItems = allItems.filter((item) => !isVerifierItem(item));
      if (encryptedDataItems.length > 0 && !legacySalt) {
        throw new Error("Vault salt is missing. Restore old browser data or reset the encrypted vault.");
      }

      const salt = legacySalt ?? randomBytes(MASTER_KEY_SALT_LENGTH);
      const derived = await deriveMasterKey({
        password: passwordInput,
        kdf,
        salt,
      });
      const derivedKey = derived.key;
      candidateKey = derivedKey;

      if (encryptedDataItems.length > 0) {
        const canDecryptAny = encryptedDataItems.some((item) => !decryptItem(item, derivedKey, aead).isCorrupted);
        if (!canDecryptAny) {
          throw new Error("Incorrect vault passphrase");
        }
      }

      const createdVerifier = await upsertVerifierItem(derivedKey, salt, aead, null);

      if (legacySalt && typeof window !== "undefined") {
        window.localStorage.removeItem(legacyStorageKey);
      }

      setKek(derivedKey);
      candidateKey = null;
      setIsKekVerified(true);
      setVerifierItem(createdVerifier);
      await loadItems(derived.key, aead);
      toast.success(encryptedDataItems.length > 0 ? "Vault unlocked and verifier secured" : "Vault unlocked");
    } catch (err) {
      wipeKeyMaterial(candidateKey);
      lockVault(false);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to unlock vault");
      }
    } finally {
      setUnlocking(false);
    }
  };

  const vaults = useMemo(() => {
    const map = new Map<string, VaultCardModel>();

    for (const entry of vaultDirectory) {
      map.set(entry.id, {
        ...entry,
        itemCount: 0,
      });
    }

    for (const item of items) {
      const existing = map.get(item.vaultId);
      if (existing) {
        existing.itemCount += 1;
        if (new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          existing.updatedAt = item.updatedAt;
        }
        continue;
      }

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

    return Array.from(map.values()).sort((left, right) => {
      if (left.id === DEFAULT_PERSONAL_VAULT_ID) {
        return -1;
      }
      if (right.id === DEFAULT_PERSONAL_VAULT_ID) {
        return 1;
      }
      return left.name.localeCompare(right.name);
    });
  }, [items, session?.name, vaultDirectory]);

  useEffect(() => {
    if (!vaults.some((vault) => vault.id === activeVaultId) && vaults.length > 0) {
      setActiveVaultId(vaults[0].id);
    }
  }, [activeVaultId, vaults]);

  const filteredVaults = useMemo(() => {
    const query = vaultQuery.trim().toLowerCase();

    return vaults.filter((vault) => {
      if (vaultFilter !== "all" && vault.type !== vaultFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return vault.name.toLowerCase().includes(query);
    });
  }, [vaultFilter, vaultQuery, vaults]);

  const activeVault = useMemo(
    () => vaults.find((vault) => vault.id === activeVaultId) ?? vaults[0] ?? null,
    [activeVaultId, vaults],
  );

  const visibleItems = useMemo(() => {
    if (!activeVault) {
      return [];
    }
    return items.filter((item) => item.vaultId === activeVault.id);
  }, [activeVault, items]);

  const corruptedCount = useMemo(() => visibleItems.filter((item) => item.isCorrupted).length, [visibleItems]);

  const startEdit = (item: VaultViewItem) => {
    if (!item.secret || item.isCorrupted) {
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

  const handleCreateItem = async (e: FormEvent) => {
    e.preventDefault();

    if (!activeVault) {
      setError("Select a vault first");
      return;
    }

    if (!(await ensureVerifiedWriteAccess())) {
      return;
    }

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

      const request = {
        ciphertext: payload.ciphertext,
        nonce: payload.nonce,
        wrapped_dek: payload.wrappedDek,
        wrap_nonce: payload.wrapNonce,
        algo_version: payload.version,
        metadata: {
          kind: "login",
          vault_id: activeVault.id,
          vault_name: activeVault.name,
          vault_type: activeVault.type,
        },
      };

      if (editingItemId) {
        await vaultService.updateItem(editingItemId, request);
      } else {
        await vaultService.createItem(request);
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

  const handleDelete = async (item: VaultViewItem) => {
    if (item.isCorrupted) {
      setError("Corrupted items require vault recovery and cannot be deleted from this view.");
      return;
    }

    if (!(await ensureVerifiedWriteAccess())) {
      return;
    }

    if (!kek || !aead) {
      return;
    }

    const confirmed = await dialog.confirm({
      title: "Delete vault item",
      message: `Delete ${item.secret?.title || "this item"}? This action cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) {
      return;
    }

    try {
      await vaultService.deleteItem(item.id);
      if (editingItemId === item.id) {
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

  const openCreateVaultModal = () => {
    setVaultModalMode("create");
    setEditingVaultId(null);
    setVaultForm({
      name: "",
      type: "personal",
      members: "",
    });
    setShowVaultModal(true);
  };

  const openEditVaultModal = (vault: VaultCardModel) => {
    setVaultModalMode("edit");
    setEditingVaultId(vault.id);
    setVaultForm({
      name: vault.name,
      type: vault.type,
      members: vault.members.join(", "),
    });
    setShowVaultModal(true);
  };

  const handleSaveVault = (e: FormEvent) => {
    e.preventDefault();

    const name = vaultForm.name.trim();
    if (!name) {
      setError("Vault name is required");
      return;
    }

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
        const found = prev.some((entry) => entry.id === editingVaultId);
        if (!found) {
          return [
            ...prev,
            {
              id: editingVaultId,
              name,
              type: vaultForm.type,
              members: vaultForm.type === "shared" ? (members.length > 0 ? members : ["You", "Family"]) : [session?.name?.trim() || "You"],
              updatedAt,
              isSystem: false,
            },
          ];
        }

        return prev.map((entry) => {
          if (entry.id !== editingVaultId) {
            return entry;
          }

          return {
            ...entry,
            name,
            type: vaultForm.type,
            members: vaultForm.type === "shared" ? (members.length > 0 ? members : ["You", "Family"]) : [session?.name?.trim() || "You"],
            updatedAt,
          };
        });
      });
      toast.success("Vault updated");
    }

    setShowVaultModal(false);
  };

  const handleDeleteVault = async (vault: VaultCardModel) => {
    if (vault.id === DEFAULT_PERSONAL_VAULT_ID || vault.isSystem) {
      await dialog.alert({
        title: "Cannot delete system vault",
        message: "This vault is required for account-level storage.",
        confirmLabel: "Got it",
      });
      return;
    }

    if (vault.itemCount > 0) {
      await dialog.alert({
        title: "Vault is not empty",
        message: "Move or delete all items in this vault before deleting it.",
        confirmLabel: "OK",
      });
      return;
    }

    const confirmed = await dialog.confirm({
      title: "Delete vault",
      message: `Delete ${vault.name}?`,
      confirmLabel: "Delete vault",
      cancelLabel: "Cancel",
    });

    if (!confirmed) {
      return;
    }

    setVaultDirectory((prev) => prev.filter((entry) => entry.id !== vault.id));
    if (activeVaultId === vault.id) {
      setActiveVaultId(DEFAULT_PERSONAL_VAULT_ID);
    }
    toast.success("Vault deleted");
  };

  const handleManageMembers = (vault: VaultCardModel) => {
    void dialog.alert({
      title: "Manage members",
      message: `Members: ${vault.members.join(", ") || "No members"}.`,
      confirmLabel: "Close",
    });
  };

  if (!kek || !isKekVerified) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Unlock Vault</h1>
          <p className="mb-6 text-sm text-slate-500">Enter your vault passphrase to verify your encryption key locally.</p>
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <form className="space-y-4" onSubmit={handleUnlock}>
            <div className="space-y-2">
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
            <Button type="submit" isLoading={unlocking} disabled={!aead || masterPassword.length === 0} className="w-full">
              Unlock Vault
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="mb-1 text-xl font-semibold text-slate-900">Vaults</h1>
            <p className="text-sm text-slate-500">Secure spaces to store and organize passwords.</p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:justify-end">
            <div className="relative min-w-[13rem] flex-1 lg:flex-none">
              <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="Search vaults"
                value={vaultQuery}
                onChange={(event) => setVaultQuery(event.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={vaultFilter}
              onChange={(event) => setVaultFilter(event.target.value as VaultFilter)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            >
              <option value="all">All</option>
              <option value="personal">Personal</option>
              <option value="shared">Shared</option>
            </select>
            <Button type="button" onClick={openCreateVaultModal} className="w-auto rounded-xl px-5">
              + Create Vault
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredVaults.map((vault) => {
            const isActive = activeVault?.id === vault.id;
            return (
              <article
                key={vault.id}
                className={`group grid gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 ${
                  isActive
                    ? "border-blue-300 shadow-[0_10px_20px_-8px_rgba(37,99,235,0.35)]"
                    : "border-slate-200 hover:-translate-y-0.5 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    {vault.type === "shared" ? <FolderLock size={18} /> : <Lock size={18} />}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                      vault.type === "shared" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {vault.type === "shared" ? "Shared" : "Personal"}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-900">{vault.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{vault.itemCount} item(s)</p>
                </div>

                {vault.type === "shared" && (
                  <div className="flex items-center">
                    {vault.members.slice(0, 4).map((member) => (
                      <span
                        key={`${vault.id}-${member}`}
                        title={member}
                        className="-mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-[10px] font-bold text-blue-700"
                      >
                        {member.slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-slate-400">Updated {new Date(vault.updatedAt).toLocaleString()}</p>

                <div className="flex flex-wrap gap-2 opacity-100 transition duration-200 md:translate-y-1 md:opacity-0 group-hover:md:translate-y-0 group-hover:md:opacity-100 group-focus-within:md:translate-y-0 group-focus-within:md:opacity-100">
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                    onClick={() => setActiveVaultId(vault.id)}
                  >
                    Open vault
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                    onClick={() => openEditVaultModal(vault)}
                  >
                    <Settings size={14} />
                    Edit
                  </button>
                  {vault.type === "shared" && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                      onClick={() => handleManageMembers(vault)}
                    >
                      <Share2 size={14} />
                      Manage members
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-600"
                    onClick={() => void handleDeleteVault(vault)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="mb-1 text-lg font-semibold text-slate-900">{activeVault ? activeVault.name : "Vault"}</h2>
            <p className="text-sm text-slate-500">Save and edit encrypted credentials in this vault.</p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            onClick={() => lockVault()}
          >
            Lock vault
          </button>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        {corruptedCount > 0 && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {corruptedCount} item(s) could not be decrypted with the current passphrase. Delete is disabled for these items.
          </div>
        )}

        <form className="space-y-4" onSubmit={handleCreateItem}>
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="username">Username / Email</Label>
            <Input
              id="username"
              type="text"
              value={draft.username}
              onChange={(event) => setDraft((prev) => ({ ...prev, username: event.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="min-h-[5.5rem] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              value={draft.notes}
              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" isLoading={saving} className="w-auto rounded-xl px-5">
              {editingItemId ? "Update Item" : "Save Item"}
            </Button>
            {editingItemId && (
              <Button type="button" variant="ghost" onClick={cancelEdit} className="w-auto rounded-xl px-5">
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Saved Items</h2>
          <button
            type="button"
            className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
            onClick={() => {
              if (aead && kek) {
                void loadItems(kek, aead);
              }
            }}
          >
            Refresh
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">Showing {visibleItems.length} item(s).</p>
        {loadingItems ? (
          <p className="text-sm text-slate-500">Loading items...</p>
        ) : visibleItems.length === 0 ? (
          <p className="text-sm text-slate-500">No items yet in this vault.</p>
        ) : (
          <div className="grid gap-3">
            {visibleItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                {item.isCorrupted || !item.secret ? (
                  <p className="font-semibold text-red-600">Unable to decrypt this item</p>
                ) : (
                  <div className="grid gap-1.5">
                    <p className="font-semibold text-slate-900">{item.secret.title || "Untitled"}</p>
                    {item.secret.username && <p className="text-sm text-slate-500">{item.secret.username}</p>}
                    <p className="font-mono text-sm text-slate-900">{item.secret.password}</p>
                    {item.secret.notes && <p className="text-sm text-slate-500">{item.secret.notes}</p>}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Updated {new Date(item.updatedAt).toLocaleString()}</span>
                  <div className="flex items-center gap-3">
                    {!item.isCorrupted && item.secret && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className={`text-xs font-semibold ${item.isCorrupted ? "cursor-not-allowed text-slate-400" : "text-red-600 hover:text-red-700"}`}
                      onClick={() => void handleDelete(item)}
                      disabled={item.isCorrupted}
                      title={item.isCorrupted ? "Corrupted items cannot be deleted here" : "Delete item"}
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

      {showVaultModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create Vault">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_36px_-14px_rgba(15,23,42,0.22)]">
            <h3 className="mb-2 text-xl font-semibold text-slate-900">{vaultModalMode === "create" ? "Create Vault" : "Edit Vault"}</h3>
            <p className="mb-6 text-sm text-slate-500">Create secure spaces and keep family credentials organized.</p>

            <form className="space-y-4" onSubmit={handleSaveVault}>
              <div className="space-y-2">
                <Label htmlFor="vault-name">Vault Name</Label>
                <Input
                  id="vault-name"
                  type="text"
                  value={vaultForm.name}
                  onChange={(event) => setVaultForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vault-type">Vault Type</Label>
                <select
                  id="vault-type"
                  value={vaultForm.type}
                  onChange={(event) => setVaultForm((prev) => ({ ...prev, type: event.target.value as VaultType }))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="personal">Personal</option>
                  <option value="shared">Shared</option>
                </select>
              </div>

              {vaultForm.type === "shared" && (
                <div className="space-y-2">
                  <Label htmlFor="vault-members">Members (comma-separated)</Label>
                  <Input
                    id="vault-members"
                    type="text"
                    value={vaultForm.members}
                    onChange={(event) => setVaultForm((prev) => ({ ...prev, members: event.target.value }))}
                    placeholder="Alex, Sam"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => setShowVaultModal(false)} className="w-auto rounded-xl px-5">
                  Cancel
                </Button>
                <Button type="submit" className="w-auto rounded-xl px-5">
                  {vaultModalMode === "create" ? "Create Vault" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
