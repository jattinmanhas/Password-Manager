package service_test

import (
	"context"
	"testing"
	"time"

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

func newTestAuthService(repo *mockAuthRepo) *service.AuthService {
	return service.NewAuthService(repo, "pepper123", time.Hour, "Test Issuer")
}

func TestRegister_Success(t *testing.T) {
	repo := &mockAuthRepo{}
	var created bool
	repo.createUserFn = func(ctx context.Context, input domain.CreateUserInput) error {
		created = true
		if input.Email != "test@example.com" {
			t.Errorf("expected test@example.com, got %s", input.Email)
		}
		if input.Name != "Test User" {
			t.Errorf("expected Test User, got %s", input.Name)
		}
		return nil
	}

	svc := newTestAuthService(repo)
	userID, err := svc.Register(context.Background(), "test@example.com", "Password123!", "Test User", "Hint")
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	if !created {
		t.Error("Register did not call CreateUserWithCredentials")
	}

	if userID == "" {
		t.Error("Register returned empty userID")
	}
}

func TestRegister_EmailTaken(t *testing.T) {
	repo := &mockAuthRepo{
		createUserFn: func(ctx context.Context, input domain.CreateUserInput) error {
			return domain.ErrEmailTaken
		},
	}

	svc := newTestAuthService(repo)
	_, err := svc.Register(context.Background(), "test@example.com", "Password123!", "Test User", "")
	if err != domain.ErrEmailTaken {
		t.Errorf("expected ErrEmailTaken, got %v", err)
	}
}

func TestLogin_FailInvalidEmail(t *testing.T) {
	svc := newTestAuthService(&mockAuthRepo{})
	_, err := svc.Login(context.Background(), domain.LoginInput{
		Email:    "invalid-email",
		Password: "Password123!",
	})
	if err != domain.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestLogin_FailNotFound(t *testing.T) {
	svc := newTestAuthService(&mockAuthRepo{}) // GetUserAuthByEmailFn will return ErrNotFound by default
	_, err := svc.Login(context.Background(), domain.LoginInput{
		Email:    "test@example.com",
		Password: "Password123!",
	})
	if err != domain.ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials for not found user, got %v", err)
	}
}

func TestLogout(t *testing.T) {
	repo := &mockAuthRepo{
		revokeSessionFn: func(ctx context.Context, tokenHash []byte) (bool, error) {
			return true, nil
		},
	}

	svc := newTestAuthService(repo)
	err := svc.Logout(context.Background(), "some-token")
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestAuthenticate(t *testing.T) {
	repo := &mockAuthRepo{
		getActiveSessionFn: func(ctx context.Context, tokenHash []byte) (domain.Session, error) {
			return domain.Session{UserID: "123", Email: "test@example.com"}, nil
		},
	}

	svc := newTestAuthService(repo)
	session, err := svc.Authenticate(context.Background(), "some-token")
	if err != nil {
		t.Fatalf("Authenticate failed: %v", err)
	}
	if session.UserID != "123" {
		t.Errorf("expected UserID 123, got %s", session.UserID)
	}
}
