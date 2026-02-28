import { argon2id } from "@noble/hashes/argon2";
import { XChaCha20Poly1305 } from "@stablelib/xchacha20poly1305";

import * as core from "../src/crypto/index.ts";

async function main() {
  const kdf = {
    async deriveKey(input) {
      return new Uint8Array(
        argon2id(input.password, input.salt, {
          t: input.params.iterations,
          m: input.params.memoryKiB,
          p: input.params.parallelism,
          dkLen: input.params.outputLength,
        }),
      );
    },
  };

  const aead = {
    keyLength: 32,
    nonceLength: 24,
    encrypt(input) {
      return new XChaCha20Poly1305(input.key).seal(
        input.nonce,
        input.plaintext,
        input.associatedData ?? new Uint8Array(),
      );
    },
    decrypt(input) {
      const out = new XChaCha20Poly1305(input.key).open(
        input.nonce,
        input.ciphertext,
        input.associatedData ?? new Uint8Array(),
      );
      if (!out) {
        throw new Error("ciphertext authentication failed");
      }
      return out;
    },
  };

  const mk = await core.deriveMasterKey({
    password: "correct horse battery staple",
    kdf,
  });
  const aad = core.utf8ToBytes("item:test");
  const payload = core.encryptVaultItem({
    plaintext: JSON.stringify({
      site: "example.com",
      username: "alice@example.com",
      password: "S3cure!Pass#123",
    }),
    kek: mk.key,
    aead,
    associatedData: aad,
  });

  const plaintext = core.decryptVaultItem({
    payload,
    kek: mk.key,
    aead,
    associatedData: aad,
  });
  if (!plaintext.includes("example.com")) {
    throw new Error("crypto roundtrip failed");
  }

  const tampered = {
    ...payload,
    ciphertext: payload.ciphertext.slice(0, -2) + "AA",
  };
  let tamperRejected = false;
  try {
    core.decryptVaultItem({
      payload: tampered,
      kek: mk.key,
      aead,
      associatedData: aad,
    });
  } catch {
    tamperRejected = true;
  }
  if (!tamperRejected) {
    throw new Error("tampered ciphertext should be rejected");
  }

  let invalidBase64Rejected = false;
  try {
    core.fromBase64("%%%");
  } catch {
    invalidBase64Rejected = true;
  }
  if (!invalidBase64Rejected) {
    throw new Error("invalid base64 should be rejected");
  }

  console.log("crypto smoke check passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
