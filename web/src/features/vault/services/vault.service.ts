import { request } from "../../../lib/api";
import {
  CreateVaultItemRequest,
  UpdateVaultItemRequest,
  VaultItemResponse,
  VaultItemsResponse,
} from "../types";

export const vaultService = {
  listItems() {
    return request<VaultItemsResponse>("GET", "/vault/items");
  },
  getItem(itemId: string) {
    return request<VaultItemResponse>("GET", `/vault/items/${itemId}`);
  },
  createItem(req: CreateVaultItemRequest) {
    return request<VaultItemResponse>("POST", "/vault/items", req);
  },
  updateItem(itemId: string, req: UpdateVaultItemRequest) {
    return request<VaultItemResponse>("PUT", `/vault/items/${itemId}`, req);
  },
  deleteItem(itemId: string) {
    return request<{ status: string }>("DELETE", `/vault/items/${itemId}`);
  },
};
