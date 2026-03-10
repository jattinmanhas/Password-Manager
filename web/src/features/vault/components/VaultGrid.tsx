import { Plus, Search } from "lucide-react";

import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { VaultCard } from "./VaultCard";
import type { VaultCardModel, VaultFilter, VaultType } from "../vault.types";

interface VaultGridProps {
  vaults: VaultCardModel[];
  activeVaultId: string;
  vaultQuery: string;
  vaultFilter: VaultFilter;
  onQueryChange: (q: string) => void;
  onFilterChange: (f: VaultFilter) => void;
  onCreateVault: () => void;
  onOpenVault: (id: string) => void;
  onEditVault: (vault: VaultCardModel) => void;
  onDeleteVault: (vault: VaultCardModel) => void;
  onManageMembers: (vault: VaultCardModel) => void;
}

export function VaultGrid({
  vaults,
  activeVaultId,
  vaultQuery,
  vaultFilter,
  onQueryChange,
  onFilterChange,
  onCreateVault,
  onOpenVault,
  onEditVault,
  onDeleteVault,
  onManageMembers,
}: VaultGridProps) {
  return (
    <div
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-2xl)",
        padding: "1.75rem",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.375rem",
              fontWeight: 700,
              color: "var(--color-text-main)",
              letterSpacing: "-0.02em",
              marginBottom: "0.25rem",
            }}
          >
            Vaults
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--color-text-subtle)" }}>
            Secure spaces to store and organize passwords.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
          {/* Search */}
          <div style={{ position: "relative", minWidth: "13rem" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-text-light)",
                pointerEvents: "none",
              }}
            />
            <Input
              type="search"
              placeholder="Search vaults…"
              value={vaultQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              style={{ paddingLeft: "2.25rem" }}
            />
          </div>

          {/* Filter */}
          <select
            value={vaultFilter}
            onChange={(e) => onFilterChange(e.target.value as VaultFilter)}
            style={{
              height: "2.75rem",
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--color-border)",
              background: "var(--color-white)",
              padding: "0 0.75rem",
              fontSize: "0.875rem",
              color: "var(--color-text-main)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">All</option>
            <option value="personal">Personal</option>
            <option value="shared">Shared</option>
          </select>

          {/* CTA */}
          <Button
            type="button"
            onClick={onCreateVault}
            style={{
              width: "auto",
              gap: "0.375rem",
              paddingLeft: "1.25rem",
              paddingRight: "1.25rem",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <Plus size={16} />
            Create Vault
          </Button>
        </div>
      </div>

      {/* Grid */}
      {vaults.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1rem",
            color: "var(--color-text-subtle)",
            fontSize: "0.875rem",
          }}
        >
          No vaults found. Create one to get started.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1rem",
          }}
        >
          {vaults.map((vault) => (
            <VaultCard
              key={vault.id}
              vault={vault}
              isActive={activeVaultId === vault.id}
              onOpen={() => onOpenVault(vault.id)}
              onEdit={() => onEditVault(vault)}
              onDelete={() => onDeleteVault(vault)}
              onManageMembers={() => onManageMembers(vault)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
