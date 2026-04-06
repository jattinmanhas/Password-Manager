import { request } from "../../../lib/api";
import {
  CreateFolderRequest,
  CreateVaultItemRequest,
  FolderResponse,
  FoldersResponse,
  UpdateVaultItemRequest,
  VaultItemResponse,
  VaultItemVersionsResponse,
  VaultItemsResponse,
  VaultSaltResponse,
} from "../types";

export const vaultService = {
  listItems() {
    return request<VaultItemsResponse>("GET", "/vault/items");
  },
  listTrashItems() {
    return request<VaultItemsResponse>("GET", "/vault/items/trash");
  },
  getItem(itemId: string) {
    return request<VaultItemResponse>("GET", `/vault/items/${itemId}`);
  },
  getItemHistory(itemId: string) {
    return request<VaultItemVersionsResponse>("GET", `/vault/items/${itemId}/history`);
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
  restoreItem(itemId: string) {
    return request<VaultItemResponse>("POST", `/vault/items/${itemId}/restore`);
  },
  getVaultSalt() {
    return request<VaultSaltResponse>("GET", "/vault/salt");
  },

  // Folders
  listFolders() {
    return request<FoldersResponse>("GET", "/folders");
  },
  createFolder(req: CreateFolderRequest) {
    return request<FolderResponse>("POST", "/folders", req);
  },
  updateFolder(folderId: string, req: CreateFolderRequest) {
    return request<FolderResponse>("PUT", `/folders/${folderId}`, req);
  },
  deleteFolder(folderId: string) {
    return request<{ status: string }>("DELETE", `/folders/${folderId}`);
  },
};
