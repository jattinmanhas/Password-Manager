import { Folder, FolderPlus, LayoutGrid, Trash2, Edit2 } from "lucide-react";
import { TRASH_VAULT_ID, type VaultCardModel } from "../vault.types";

interface VaultSidebarProps {
  vaults: VaultCardModel[];
  activeVaultId: string;
  onSelectVault: (id: string) => void;
  onCreateFolder: () => void;
  onEditFolder: (vault: VaultCardModel) => void;
  onDeleteFolder: (vault: VaultCardModel) => void;
}

export function VaultSidebar({
  vaults,
  activeVaultId,
  onSelectVault,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
}: VaultSidebarProps) {
  return (
    <div className="vault-sidebar">
      <div className="vault-sidebar-heading">
        <span>Vaults &amp; Folders</span>
        <button
          onClick={onCreateFolder}
          className="vault-sidebar-create"
          title="Create Folder"
        >
          <FolderPlus size={15} />
        </button>
      </div>

      <div className="vault-sidebar-list">
        {vaults.map((vault) => {
          const isActive = vault.id === activeVaultId;
          return (
            <button
              key={vault.id}
              className={`vault-sidebar-entry${!vault.isSystem ? " vault-sidebar-entry--editable" : ""}`}
              data-active={isActive}
              onClick={() => onSelectVault(vault.id)}
            >
              <span className="vault-sidebar-entry-icon">
                {vault.isSystem ? (
                  vault.id === TRASH_VAULT_ID ? (
                    <Trash2 size={16} />
                  ) : (
                    <LayoutGrid size={16} />
                  )
                ) : (
                  <Folder size={16} />
                )}
              </span>

              <span className="vault-sidebar-entry-name">{vault.name}</span>

              {vault.itemCount > 0 && (
                <span
                  className="vault-sidebar-entry-count"
                  style={{
                    backgroundColor: isActive
                      ? "var(--color-security-blue)"
                      : "var(--color-bg-light, var(--color-soft-gray))",
                    color: isActive ? "white" : "var(--color-text-subtle)",
                  }}
                >
                  {vault.itemCount}
                </span>
              )}

              {!vault.isSystem && (
                <div className="vault-sidebar-entry-edit">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFolder(vault);
                    }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFolder(vault);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
