# Encryption Module

This module handles all client-side encryption and decryption operations. This is a critical component that ensures zero-knowledge architecture - the server never sees unencrypted data.

## Key Principles

1. **All encryption happens on the client** - Never send plaintext to server
2. **Master password never leaves the client** - Only key derivation proof sent
3. **AES-256-GCM** - Industry standard encryption
4. **PBKDF2** - Secure key derivation with 100,000+ iterations

## Usage Example

```typescript
import { deriveKey, encrypt, decrypt } from './crypto';

// Derive encryption key from master password
const masterPassword = 'user-master-password';
const salt = generateSalt();
const encryptionKey = await deriveKey(masterPassword, salt);

// Encrypt vault item
const plaintext = JSON.stringify({
  username: 'user@example.com',
  password: 'secret123',
  url: 'https://example.com'
});

const encrypted = await encrypt(plaintext, encryptionKey);

// Decrypt vault item
const decrypted = await decrypt(encrypted, encryptionKey);
const vaultItem = JSON.parse(decrypted);
```

## Security Notes

- Never log encryption keys or master passwords
- Always use secure random number generation
- Validate inputs before encryption
- Use authenticated encryption (AES-GCM) to prevent tampering


