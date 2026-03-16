import { Folder, FolderPlus, LayoutGrid, Plus, Search, Tag, Trash2, Edit2 } from "lucide-react";
import type { VaultCardModel, VaultFolder } from "../vault.types";

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
    <div
      style={{
        width: "18rem",
        backgroundColor: "var(--color-white)",
        borderRight: "1px solid var(--color-border)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        padding: "1.5rem 0",
      }}
    >
      <div style={{ padding: "0 1.5rem 1.5rem 1.5rem" }}>
        <h3
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--color-text-light)",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Vaults & Folders</span>
          <button
            onClick={onCreateFolder}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-primary)",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: "0.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Create Folder"
          >
            <FolderPlus size={16} />
          </button>
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {vaults.map((vault) => {
            const isActive = vault.id === activeVaultId;
            return (
              <div
                key={vault.id}
                data-group="vault-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "0.75rem",
                  backgroundColor: isActive ? "rgba(37, 99, 235, 0.08)" : "transparent",
                  color: isActive ? "var(--color-primary)" : "var(--color-text-main)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
                onClick={() => onSelectVault(vault.id)}
              >
                <div style={{ marginRight: "0.75rem", display: "flex", alignItems: "center" }}>
                  {vault.isSystem ? <LayoutGrid size={18} /> : <Folder size={18} />}
                </div>
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 500,
                    flex: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {vault.name}
                </span>
                {vault.itemCount > 0 && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      backgroundColor: isActive ? "var(--color-primary)" : "var(--color-bg-light)",
                      color: isActive ? "white" : "var(--color-text-subtle)",
                      padding: "0.125rem 0.5rem",
                      borderRadius: "1rem",
                      marginLeft: "0.5rem",
                    }}
                  >
                    {vault.itemCount}
                  </span>
                )}
                
                {/* Actions that appear on hover */}
                {!vault.isSystem && (
                   <div 
                    className="vault-actions"
                    style={{ 
                      position: "absolute", 
                      right: "0.5rem", 
                      display: "none", // Will be shown via CSS if possible, but let's use a wrapper for hover
                      gap: "0.25rem",
                      backgroundColor: isActive ? "#f0f7ff" : "white",
                      paddingLeft: "0.5rem"
                    }}
                   >
                     <button 
                      onClick={(e) => { e.stopPropagation(); onEditFolder(vault); }}
                      style={{ background: "none", border: "none", color: "var(--color-text-light)", cursor: "pointer" }}
                     >
                       <Edit2 size={14} />
                     </button>
                     <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteFolder(vault); }}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                     >
                       <Trash2 size={14} />
                     </button>
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "auto", padding: "1.5rem", borderTop: "1px solid var(--color-border)" }}>
         <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--color-text-subtle)", fontSize: "0.875rem" }}>
           <Tag size={16} />
           <span>Tags System Enabled</span>
         </div>
      </div>
      
      <style>{`
        div[data-group="vault-item"]:hover .vault-actions {
          display: flex !important;
        }
      `}</style>
    </div>
  );
}
