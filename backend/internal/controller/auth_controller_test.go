package controller_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"pmv2/backend/internal/controller"
	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/service"
)

type mockAuthRepo struct {
	createUserFn            func(ctx context.Context, input domain.CreateUserInput) error
	getUserAuthByEmailFn    func(ctx context.Context, email string) (domain.UserAuthRecord, error)
	createSessionFn         func(ctx context.Context, input domain.CreateSessionInput) error
	getActiveSessionFn      func(ctx context.Context, tokenHash []byte) (domain.Session, error)
	revokeSessionFn         func(ctx context.Context, tokenHash []byte) (bool, error)
	setTOTPSecretFn         func(ctx context.Context, userID string, secretEnc []byte) (bool, error)
	enableTOTPFn            func(ctx context.Context, userID string) error
	getTOTPStateFn          func(ctx context.Context, userID string) (domain.TOTPState, error)
	recordTOTPFailureFn     func(ctx context.Context, userID string, now time.Time, maxAttempts int, window time.Duration, lockDuration time.Duration) (*time.Time, error)
	resetTOTPFailuresFn     func(ctx context.Context, userID string) error
	replaceRecoveryCodesFn  func(ctx context.Context, userID string, codeHashes [][]byte) error
	consumeRecoveryCodeFn   func(ctx context.Context, userID string, codeHash []byte) (bool, error)
	deleteExpiredSessionsFn func(ctx context.Context) (int64, error)
}

func (m *mockAuthRepo) CreateUserWithCredentials(ctx context.Context, input domain.CreateUserInput) error {
	if m.createUserFn != nil {
		return m.createUserFn(ctx, input)
	}
	return nil
}
func (m *mockAuthRepo) GetUserAuthByEmail(ctx context.Context, email string) (domain.UserAuthRecord, error) {
	if m.getUserAuthByEmailFn != nil {
		return m.getUserAuthByEmailFn(ctx, email)
	}
	return domain.UserAuthRecord{}, domain.ErrNotFound
}
func (m *mockAuthRepo) CreateSession(ctx context.Context, input domain.CreateSessionInput) error {
	if m.createSessionFn != nil {
		return m.createSessionFn(ctx, input)
	}
	return nil
}
func (m *mockAuthRepo) GetActiveSessionByTokenHash(ctx context.Context, tokenHash []byte) (domain.Session, error) {
	if m.getActiveSessionFn != nil {
		return m.getActiveSessionFn(ctx, tokenHash)
	}
	return domain.Session{}, domain.ErrNotFound
}
func (m *mockAuthRepo) RevokeSessionByTokenHash(ctx context.Context, tokenHash []byte) (bool, error) {
	if m.revokeSessionFn != nil {
		return m.revokeSessionFn(ctx, tokenHash)
	}
	return true, nil
}
func (m *mockAuthRepo) SetTOTPSecret(ctx context.Context, userID string, secretEnc []byte) (bool, error) {
	if m.setTOTPSecretFn != nil {
		return m.setTOTPSecretFn(ctx, userID, secretEnc)
	}
	return true, nil
}
func (m *mockAuthRepo) EnableTOTP(ctx context.Context, userID string) error {
	if m.enableTOTPFn != nil {
		return m.enableTOTPFn(ctx, userID)
	}
	return nil
}
func (m *mockAuthRepo) GetTOTPState(ctx context.Context, userID string) (domain.TOTPState, error) {
	if m.getTOTPStateFn != nil {
		return m.getTOTPStateFn(ctx, userID)
	}
	return domain.TOTPState{}, domain.ErrNotFound
}
func (m *mockAuthRepo) RecordTOTPFailure(ctx context.Context, userID string, now time.Time, maxAttempts int, window time.Duration, lockDuration time.Duration) (*time.Time, error) {
	if m.recordTOTPFailureFn != nil {
		return m.recordTOTPFailureFn(ctx, userID, now, maxAttempts, window, lockDuration)
	}
	return nil, nil
}
func (m *mockAuthRepo) ResetTOTPFailures(ctx context.Context, userID string) error {
	if m.resetTOTPFailuresFn != nil {
		return m.resetTOTPFailuresFn(ctx, userID)
	}
	return nil
}
func (m *mockAuthRepo) ReplaceRecoveryCodes(ctx context.Context, userID string, codeHashes [][]byte) error {
	if m.replaceRecoveryCodesFn != nil {
		return m.replaceRecoveryCodesFn(ctx, userID, codeHashes)
	}
	return nil
}
func (m *mockAuthRepo) ConsumeRecoveryCode(ctx context.Context, userID string, codeHash []byte) (bool, error) {
	if m.consumeRecoveryCodeFn != nil {
		return m.consumeRecoveryCodeFn(ctx, userID, codeHash)
	}
	return false, nil
}
func (m *mockAuthRepo) DeleteExpiredSessions(ctx context.Context) (int64, error) {
	if m.deleteExpiredSessionsFn != nil {
		return m.deleteExpiredSessionsFn(ctx)
	}
	return 0, nil
}

func setupController(repo *mockAuthRepo) *controller.AuthController {
	svc := service.NewAuthService(repo, "pepper-test", time.Hour, "issuer")
	return controller.NewAuthController(svc)
}

func TestHandleRegister_Success(t *testing.T) {
	repo := &mockAuthRepo{
		createUserFn: func(ctx context.Context, input domain.CreateUserInput) error {
			return nil
		},
	}
	c := setupController(repo)

	body := map[string]string{
		"email":    "test@example.com",
		"password": "Password123!",
		"name":     "Test",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(b))
	rec := httptest.NewRecorder()

	c.HandleRegister(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201 Created, got %d", rec.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["status"] != "registered" {
		t.Errorf("expected status=registered, got %v", resp["status"])
	}
	if resp["email"] == nil || resp["name"] == nil {
		t.Errorf("expected email and name to be present in response")
	}
}

func TestHandleRegister_EmailTaken(t *testing.T) {
	repo := &mockAuthRepo{
		createUserFn: func(ctx context.Context, input domain.CreateUserInput) error {
			return domain.ErrEmailTaken
		},
	}
	c := setupController(repo)

	body := map[string]string{
		"email":    "test@example.com",
		"password": "Password123!",
		"name":     "Test",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(b))
	rec := httptest.NewRecorder()

	c.HandleRegister(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("expected 409 Conflict, got %d", rec.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["error"] != "email_taken" {
		t.Errorf("expected error=email_taken, got %v", resp["error"])
	}
}

func TestHandleLogin_InvalidCredentials(t *testing.T) {
	repo := &mockAuthRepo{
		getUserAuthByEmailFn: func(ctx context.Context, email string) (domain.UserAuthRecord, error) {
			return domain.UserAuthRecord{}, domain.ErrNotFound
		},
	}
	c := setupController(repo)

	body := map[string]string{
		"email":    "test@example.com",
		"password": "WrongPassword123!",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(b))
	rec := httptest.NewRecorder()

	c.HandleLogin(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", rec.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["error"] != "invalid_credentials" {
		t.Errorf("expected error=invalid_credentials, got %v", resp["error"])
	}
}

func TestHandleLogin_InvalidJSON(t *testing.T) {
	c := setupController(&mockAuthRepo{})

	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader([]byte(`{invalid`)))
	rec := httptest.NewRecorder()

	c.HandleLogin(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request, got %d", rec.Code)
	}
}
