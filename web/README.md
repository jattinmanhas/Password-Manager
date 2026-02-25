# PMV2 Web Client

Web-first client application workspace.

Current Week 1 progress:

- Added a TypeScript crypto module at `src/crypto/`.
- Added Argon2id KDF + XChaCha20-Poly1305 adapter scaffolding:
  - `src/crypto/index.ts`
  - `src/crypto/adapters.ts`
- Added `package.json` + `tsconfig.json` for type-checking.

## Crypto module usage

1. Install dependencies:

```bash
npm install
```

2. Use adapters and helpers:

```ts
import { createDefaultArgon2idKdf, createDefaultXChaCha20Poly1305 } from "./src/crypto/adapters";
import { deriveMasterKey, encryptVaultItem, decryptVaultItem } from "./src/crypto/index";

const kdf = await createDefaultArgon2idKdf();
const aead = await createDefaultXChaCha20Poly1305();

const master = await deriveMasterKey({
  password: "your master password",
  kdf,
});

const encrypted = encryptVaultItem({
  plaintext: JSON.stringify({ title: "Email", username: "alice@example.com" }),
  kek: master.key,
  aead,
});

const decrypted = decryptVaultItem({
  payload: encrypted,
  kek: master.key,
  aead,
});
```
