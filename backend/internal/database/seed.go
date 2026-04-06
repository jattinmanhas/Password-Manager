package database

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	mrand "math/rand"
	"time"

	"github.com/google/uuid"
	"pmv2/backend/internal/domain"
	"pmv2/backend/internal/repository"
	"pmv2/backend/internal/util"
)

type Seeder struct {
	db         *Postgres
	authRepo   domain.AuthRepository
	vaultRepo  domain.VaultRepository
	folderRepo domain.FolderRepository
	auditRepo  *repository.AuditRepository // Using concrete type for CreateEvent if interface is missing
	familyRepo domain.FamilyRepository
	pepper     string
}

func NewSeeder(db *Postgres, authRepo domain.AuthRepository, vaultRepo domain.VaultRepository, folderRepo domain.FolderRepository, auditRepo *repository.AuditRepository, familyRepo domain.FamilyRepository, pepper string) *Seeder {
	return &Seeder{
		db:         db,
		authRepo:   authRepo,
		vaultRepo:  vaultRepo,
		folderRepo: folderRepo,
		auditRepo:  auditRepo,
		familyRepo: familyRepo,
		pepper:     pepper,
	}
}

func (s *Seeder) SeedAll(ctx context.Context) error {
	log.Println("Starting database seeding...")

	testUsers := []struct {
		Name  string
		Email string
	}{
		{"Alice Smith", "alice@pm.me"},
		{"Bob Johnson", "bob@pm.me"},
		{"Charlie Brown", "charlie@pm.me"},
		{"Diana Prince", "diana@pm.me"},
		{"Evan Wright", "evan@pm.me"},
	}

	userIDs := make([]string, 0, len(testUsers))

	for _, u := range testUsers {
		userID, err := s.seedUser(ctx, u.Name, u.Email)
		if err != nil {
			return fmt.Errorf("seed user %s: %w", u.Email, err)
		}
		userIDs = append(userIDs, userID)
		log.Printf("Seeded user: %s (%s)", u.Name, u.Email)

		// Seed folders for each user
		folders := []string{"Work", "Personal", "Social", "Finances"}
		folderIDs := make([]string, 0, len(folders))
		for _, fName := range folders {
			fID, err := s.seedFolder(ctx, userID, fName)
			if err != nil {
				return fmt.Errorf("seed folder %s for %s: %w", fName, u.Email, err)
			}
			folderIDs = append(folderIDs, fID)
		}

		// Seed items for each user
		for i := 0; i < 15; i++ {
			fID := ""
			if i%2 == 0 {
				fID = folderIDs[i%len(folderIDs)]
			}
			err := s.seedVaultItem(ctx, userID, fID, i)
			if err != nil {
				return fmt.Errorf("seed vault item %d for %s: %w", i, u.Email, err)
			}
		}

		// Seed audit events for each user
		err = s.seedAuditEvents(ctx, userID)
		if err != nil {
			return fmt.Errorf("seed audit events for %s: %w", u.Email, err)
		}
	}

	// Seed family relationships
	err := s.seedFamily(ctx, userIDs)
	if err != nil {
		return fmt.Errorf("seed family: %w", err)
	}

	log.Println("Database seeding completed successfully.")
	return nil
}

func (s *Seeder) seedUser(ctx context.Context, name, email string) (string, error) {
	password := "Password123!"
	params := util.DefaultArgon2Params()
	paramsJSON, _ := util.MarshalArgon2Params(params)
	salt, hash, _ := util.HashPassword(password, params)

	userID := uuid.New().String()
	err := s.authRepo.CreateUserWithCredentials(ctx, domain.CreateUserInput{
		UserID:       userID,
		Email:        email,
		Name:         name,
		Algo:         "argon2id",
		ParamsJSON:   paramsJSON,
		Salt:         salt,
		PasswordHash: hash,
	})
	if err != nil {
		return "", err
	}

	return userID, nil
}

func (s *Seeder) seedFolder(ctx context.Context, userID, name string) (string, error) {
	nonce := make([]byte, 12)
	_, _ = rand.Read(nonce)

	// Mock encrypted name (just a random-looking hex string)
	encryptedName := []byte(fmt.Sprintf("enc_%s", name))

	folder, err := s.folderRepo.CreateFolder(ctx, domain.CreateVaultFolderInput{
		OwnerUserID:    userID,
		NameCiphertext: encryptedName,
		Nonce:          nonce,
	})
	if err != nil {
		return "", err
	}
	return folder.ID, nil // Use the actual ID from the repo
}

func (s *Seeder) seedVaultItem(ctx context.Context, userID, folderID string, index int) error {
	nonce := make([]byte, 12)
	_, _ = rand.Read(nonce)
	wrappedDEK := make([]byte, 32)
	_, _ = rand.Read(wrappedDEK)
	wrapNonce := make([]byte, 12)
	_, _ = rand.Read(wrapNonce)

	metadata := map[string]interface{}{
		"name": fmt.Sprintf("Account %d", index),
		"type": "login",
		"url":  fmt.Sprintf("https://service-%d.com", index),
	}
	metadataJSON, _ := json.Marshal(metadata)

	var fPtr *string
	if folderID != "" {
		copyFID := folderID
		fPtr = &copyFID
	}

	_, err := s.vaultRepo.CreateVaultItem(ctx, domain.CreateVaultItemInput{
		OwnerUserID: userID,
		FolderID:    fPtr,
		Ciphertext:  []byte(fmt.Sprintf("mock_ciphertext_%d", index)),
		Nonce:       nonce,
		WrappedDEK:  wrappedDEK,
		WrapNonce:   wrapNonce,
		AlgoVersion: "v1",
		Metadata:    metadataJSON,
	})
	return err
}

func (s *Seeder) seedAuditEvents(ctx context.Context, userID string) error {
	events := []struct {
		Type domain.EventType
		Data map[string]string
	}{
		{domain.EventTypeAuthLoginSuccess, map[string]string{"ip": "127.0.0.1", "device": "Chrome Mac"}},
		{domain.EventTypeVaultItemCreated, map[string]string{"item_name": "Gmail"}},
		{domain.EventTypeAuthProfileUpdated, map[string]string{"field": "display_name"}},
		{domain.EventTypeVaultItemUpdated, map[string]string{"item_name": "Gmail"}},
	}

	uid, _ := uuid.Parse(userID)
	for _, e := range events {
		dataJSON, _ := json.Marshal(e.Data)
		err := s.auditRepo.CreateEvent(ctx, domain.AuditEvent{
			ID:        uuid.New(),
			UserID:    &uid,
			EventType: e.Type,
			EventData: json.RawMessage(dataJSON),
			CreatedAt: time.Now().Add(-time.Duration(mrand.Intn(100)) * time.Hour),
		})
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Seeder) seedFamily(ctx context.Context, userIDs []string) error {
	if len(userIDs) < 4 {
		return nil
	}

	// Alice (0) invites Bob (1) - Accepted
	err := s.familyRepo.CreateRequest(ctx, userIDs[0], userIDs[1])
	if err != nil {
		return err
	}
	err = s.familyRepo.AcceptRequest(ctx, userIDs[1], userIDs[0])
	if err != nil {
		return err
	}

	// Alice (0) invites Charlie (2) - Pending
	err = s.familyRepo.CreateRequest(ctx, userIDs[0], userIDs[2])
	if err != nil {
		return err
	}

	// Bob (1) invites Diana (3) - Accepted
	err = s.familyRepo.CreateRequest(ctx, userIDs[1], userIDs[3])
	if err != nil {
		return err
	}
	err = s.familyRepo.AcceptRequest(ctx, userIDs[3], userIDs[1])
	if err != nil {
		return err
	}

	return nil
}
