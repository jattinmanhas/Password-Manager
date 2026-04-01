package dto

// ─── Requests ────────────────────────────────────────────────────────

type SendFamilyRequestInput struct {
	Email string `json:"email"`
}

type RespondFamilyRequestInput struct {
	UserID string `json:"user_id"`
}

// ─── Responses ───────────────────────────────────────────────────────

type FamilyMemberResponse struct {
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

type FamilyMembersResponse struct {
	Members []FamilyMemberResponse `json:"members"`
}

type FamilyRequestResponse struct {
	UserID      string `json:"user_id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	InitiatedBy string `json:"initiated_by"`
	CreatedAt   string `json:"created_at"`
}

type FamilyRequestsResponse struct {
	Received []FamilyRequestResponse `json:"received"`
	Sent     []FamilyRequestResponse `json:"sent"`
}
