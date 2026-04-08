/// <reference lib="webworker" />

import { argon2id } from "@noble/hashes/argon2";
import { XChaCha20Poly1305 } from "@stablelib/xchacha20poly1305";

import {
  decryptVaultItem,
  deriveMasterKey,
  type Argon2idKdf,
  type EncryptedVaultItem,
  utf8ToBytes,
} from "./index";
import type {
  CryptoWorkerRequestPayload,
  CryptoWorkerResponsePayload,
} from "./worker.types";
import { constantTimeEquals, getVaultReference, normalizeSecret } from "../vault.utils";

type WorkerRequestMessage = {
  id: number;
  payload: CryptoWorkerRequestPayload;
};

type WorkerResponseMessage = {
  id: number;
  ok: true;
  payload: CryptoWorkerResponsePayload;
} | {
  id: number;
  ok: false;
  error: string;
};

const argon2Kdf: Argon2idKdf = {
  async deriveKey(input) {
    const out = argon2id(input.password, input.salt, {
      t: input.params.iterations,
      m: input.params.memoryKiB,
      p: input.params.parallelism,
      dkLen: input.params.outputLength,
    });
    return new Uint8Array(out);
  },
};

const aead = new XChaCha20Poly1305(new Uint8Array(32));
const cipher = {
  keyLength: 32,
  nonceLength: 24,
  encrypt: () => {
    throw new Error("worker cipher encrypt is not used");
  },
  decrypt(input: {
    key: Uint8Array;
    nonce: Uint8Array;
    ciphertext: Uint8Array;
    associatedData?: Uint8Array;
  }): Uint8Array {
    const instance = new XChaCha20Poly1305(input.key);
    const result = instance.open(input.nonce, input.ciphertext, input.associatedData ?? new Uint8Array());
    if (!result) {
      throw new Error("ciphertext authentication failed");
    }
    return result;
  },
};

const VERIFIER_TOKEN_BYTES = utf8ToBytes("pmv2-kek-verifier-v1");

self.onmessage = async (event: MessageEvent<WorkerRequestMessage>) => {
  const { id, payload } = event.data;
  try {
    let response: CryptoWorkerResponsePayload;

    switch (payload.type) {
      case "derive-key": {
        const derived = await deriveMasterKey({
          password: payload.password,
          kdf: argon2Kdf,
          salt: payload.salt,
          params: payload.params,
        });
        response = derived;
        break;
      }

      case "verify-vault-key": {
        const derived = await deriveMasterKey({
          password: payload.password,
          kdf: argon2Kdf,
          salt: payload.salt,
        });

        let verified = false;
        try {
          const plaintext = decryptVaultItem({
            payload: payload.payload as EncryptedVaultItem,
            kek: derived.key,
            aead: cipher,
          });
          verified = constantTimeEquals(utf8ToBytes(plaintext), VERIFIER_TOKEN_BYTES);
        } catch {
          verified = false;
        }

        if (!verified) {
          derived.key.fill(0);
        }

        response = {
          verified,
          key: verified ? derived.key : null,
          salt: derived.salt,
          params: derived.params,
        };
        break;
      }

      case "decrypt-vault-items": {
        const items = payload.items.map((item) => {
          const vaultRef = getVaultReference(item.metadata);
          try {
            const plaintext = decryptVaultItem({
              payload: {
                version: "xchacha20poly1305-v1",
                nonce: item.nonce,
                ciphertext: item.ciphertext,
                wrappedDek: item.wrapped_dek,
                wrapNonce: item.wrap_nonce,
              },
              kek: payload.kek,
              aead: cipher,
            });

            return {
              id: item.id,
              folderId: item.folder_id,
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              deletedAt: item.deleted_at,
              version: item.version,
              secret: normalizeSecret(JSON.parse(plaintext)),
              isCorrupted: false,
              isShared: item.is_shared,
              ...vaultRef,
            };
          } catch {
            return {
              id: item.id,
              folderId: item.folder_id,
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              deletedAt: item.deleted_at,
              version: item.version,
              secret: null,
              isCorrupted: true,
              isShared: item.is_shared,
              ...vaultRef,
            };
          }
        });

        response = { items };
        break;
      }

      default: {
        throw new Error("unsupported worker request");
      }
    }

    const message: WorkerResponseMessage = { id, ok: true, payload: response };
    self.postMessage(message);
  } catch (error) {
    const message: WorkerResponseMessage = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : "crypto worker request failed",
    };
    self.postMessage(message);
  }
};

void aead;
