/** Types for the Family Members API and UI. */

export interface FamilyMember {
  user_id: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
}

export interface FamilyMembersResponse {
  members: FamilyMember[];
}

export interface FamilyRequest {
  user_id: string;
  email: string;
  name: string;
  initiated_by: string;
  created_at: string;
}

export interface FamilyRequestsResponse {
  received: FamilyRequest[];
  sent: FamilyRequest[];
}
