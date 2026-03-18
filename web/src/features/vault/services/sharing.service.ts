import { request } from "../../../lib/api";
import type {
  UpsertUserKeysRequest,
  UserKeysResponse,
  UserPublicKeyResponse,
  ShareItemRequest,
  ShareItemResponse,
  ShareRecipientsResponse,
  SharedItemsResponse,
} from "../sharing.types";

export const sharingService = {
  // User keys
  upsertUserKeys(req: UpsertUserKeysRequest) {
    return request<{ status: string }>("PUT", "/users/keys", req);
  },
  getMyKeys() {
    return request<UserKeysResponse>("GET", "/users/keys");
  },
  getPublicKey(email: string) {
    return request<UserPublicKeyResponse>(
      "GET",
      `/users/keys/lookup?email=${encodeURIComponent(email)}`
    );
  },

  // Sharing
  shareItem(itemId: string, req: ShareItemRequest) {
    return request<ShareItemResponse>(
      "POST",
      `/vault/items/${itemId}/shares`,
      req
    );
  },
  revokeShare(itemId: string, userId: string) {
    return request<{ status: string }>(
      "DELETE",
      `/vault/items/${itemId}/shares/${userId}`
    );
  },
  listSharedWithMe() {
    return request<SharedItemsResponse>("GET", "/vault/shared");
  },
  listSharesForItem(itemId: string) {
    return request<ShareRecipientsResponse>(
      "GET",
      `/vault/items/${itemId}/shares`
    );
  },
};
