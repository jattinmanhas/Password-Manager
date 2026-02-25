import {
  Argon2idKdf,
  Argon2idParams,
  XChaCha20Poly1305Aead,
} from "./index";

export async function createDefaultArgon2idKdf(): Promise<Argon2idKdf> {
  const mod = await import("@noble/hashes/argon2");
  return {
    async deriveKey(input: {
      password: Uint8Array;
      salt: Uint8Array;
      params: Argon2idParams;
    }): Promise<Uint8Array> {
      const out = mod.argon2id(input.password, input.salt, {
        t: input.params.iterations,
        m: input.params.memoryKiB,
        p: input.params.parallelism,
        dkLen: input.params.outputLength,
      });
      return new Uint8Array(out);
    },
  };
}

export async function createDefaultXChaCha20Poly1305(): Promise<XChaCha20Poly1305Aead> {
  const mod = await import("@stablelib/xchacha20poly1305");
  const nonceLength = 24;
  const keyLength = 32;

  return {
    keyLength,
    nonceLength,
    encrypt(input): Uint8Array {
      const cipher = new mod.XChaCha20Poly1305(input.key);
      return cipher.seal(input.nonce, input.plaintext, input.associatedData ?? new Uint8Array());
    },
    decrypt(input): Uint8Array {
      const cipher = new mod.XChaCha20Poly1305(input.key);
      const result = cipher.open(input.nonce, input.ciphertext, input.associatedData ?? new Uint8Array());
      if (!result) {
        throw new Error("ciphertext authentication failed");
      }
      return result;
    },
  };
}
