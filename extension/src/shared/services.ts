import { request } from "./api";
import type {
  CreateVaultItemRequest,
  VaultItemsResponse,
  VaultSaltResponse,
  KDFParamsResponse,
} from "./types/vault-api.types";
import type { SessionResponse } from "./types/auth.types";

export const authService = {
  me() {
    return request<SessionResponse>("GET", "/auth/me");
  },
  logout() {
    return request<void>("POST", "/auth/logout");
  },
};

export const vaultService = {
  listItems() {
    return request<VaultItemsResponse>("GET", "/vault/items");
  },
  createItem(req: CreateVaultItemRequest) {
    return request<void>("POST", "/vault/items", req);
  },
  getVaultSalt() {
    return request<VaultSaltResponse>("GET", "/vault/salt");
  },
  getKDFParams() {
    return request<KDFParamsResponse>("GET", "/vault/kdf-params");
  },
};
