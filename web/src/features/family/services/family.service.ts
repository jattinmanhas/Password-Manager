import { request } from "../../../lib/api";
import type {
  FamilyMembersResponse,
  FamilyRequestsResponse,
} from "../family.types";

export const familyService = {
  /** Send a family request to a user by email. */
  sendRequest(email: string) {
    return request<{ status: string }>("POST", "/family/request", { email });
  },

  /** Accept a pending family request. */
  acceptRequest(userId: string) {
    return request<{ status: string }>("POST", "/family/request/accept", {
      user_id: userId,
    });
  },

  /** Reject a pending family request. */
  rejectRequest(userId: string) {
    return request<{ status: string }>("POST", "/family/request/reject", {
      user_id: userId,
    });
  },

  /** Remove an accepted family member. */
  removeMember(userId: string) {
    return request<{ status: string }>("DELETE", `/family/${userId}`);
  },

  /** List all accepted family members. */
  listMembers() {
    return request<FamilyMembersResponse>("GET", "/family");
  },

  /** List pending family requests (received + sent). */
  listRequests() {
    return request<FamilyRequestsResponse>("GET", "/family/requests");
  },
};
