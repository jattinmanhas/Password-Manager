package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/md5"
	"encoding/hex"
	"fmt"
)

// DeterministicEncrypt encrypts data deterministically for searchable encryption
// Same plaintext + key = same ciphertext (allows searching)
// WARNING: Less secure than random encryption, use only for searchable metadata
func DeterministicEncrypt(plaintext string, key []byte) (string, error) {
	// Derive IV from plaintext using MD5 (deterministic)
	hash := md5.Sum([]byte(plaintext))
	iv := hash[:12] // Use first 12 bytes as IV

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	ciphertext := gcm.Seal(nil, iv, []byte(plaintext), nil)
	result := append(iv, ciphertext...)
	return hex.EncodeToString(result), nil
}

// DeterministicDecrypt decrypts deterministically encrypted data
func DeterministicDecrypt(encryptedHex string, key []byte) (string, error) {
	encrypted, err := hex.DecodeString(encryptedHex)
	if err != nil {
		return "", fmt.Errorf("failed to decode hex: %w", err)
	}

	if len(encrypted) < 12+16 {
		return "", fmt.Errorf("encrypted data too short")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	iv := encrypted[:12]
	ciphertext := encrypted[12:]

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// GenerateSearchKey generates a search key from user's encryption key
// This allows searching encrypted metadata
func GenerateSearchKey(userEncryptionKey []byte) []byte {
	// Use a hash of the encryption key for search operations
	hash := md5.Sum(userEncryptionKey)
	return hash[:]
}

// EncryptSearchableField encrypts a field that needs to be searchable
func EncryptSearchableField(plaintext string, searchKey []byte) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	return DeterministicEncrypt(plaintext, searchKey)
}

// DecryptSearchableField decrypts a searchable field
func DecryptSearchableField(encrypted string, searchKey []byte) (string, error) {
	if encrypted == "" {
		return "", nil
	}
	return DeterministicDecrypt(encrypted, searchKey)
}

// HashForSearch creates a searchable hash of text
// This allows partial matching without full decryption
func HashForSearch(text string) string {
	hash := md5.Sum([]byte(text))
	return hex.EncodeToString(hash[:])
}

// EncryptMetadata encrypts metadata for storage (deterministic for search)
func EncryptMetadata(metadata map[string]string, searchKey []byte) (map[string]string, error) {
	encrypted := make(map[string]string)
	for k, v := range metadata {
		if v != "" {
			enc, err := EncryptSearchableField(v, searchKey)
			if err != nil {
				return nil, err
			}
			encrypted[k] = enc
		}
	}
	return encrypted, nil
}

