/**
 * X25519-based key exchange utilities for secure vault item sharing.
 *
 * Flow:
 * 1. Each user generates an X25519 key pair; the private key is encrypted by their KEK.
 * 2. To share, sender does ECDH(senderPrivate, recipientPublic) → shared secret.
 * 3. Shared secret is used as an XChaCha20-Poly1305 key to wrap the item DEK.
 * 4. Recipient does ECDH(recipientPrivate, senderPublic) → same shared secret → unwrap DEK.
 */

import type { XChaCha20Poly1305Aead } from "./index";
import { randomBytes, toBase64, fromBase64 } from "./index";

export interface X25519KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface EncryptedKeyPair {
  publicKey: Uint8Array;
  encryptedPrivateKey: Uint8Array;
  nonce: Uint8Array;
}

const SHARE_DEK_WRAP_AAD = "pmv2:share-dek-wrap:v1";

/**
 * Generate an X25519 key pair using @stablelib/x25519.
 */
export async function generateX25519KeyPair(): Promise<X25519KeyPair> {
  const mod = await import("@stablelib/x25519");
  const kp = mod.generateKeyPair();
  return {
    publicKey: new Uint8Array(kp.publicKey),
    privateKey: new Uint8Array(kp.secretKey),
  };
}

/**
 * Encrypt the private key with the user's KEK (symmetric AEAD).
 */
export function encryptPrivateKey(
  privateKey: Uint8Array,
  kek: Uint8Array,
  aead: XChaCha20Poly1305Aead,
): EncryptedKeyPair & { publicKey: never } & { nonce: Uint8Array; encryptedPrivateKey: Uint8Array } {
  const nonce = randomBytes(aead.nonceLength);
  const encryptedPrivateKey = aead.encrypt({
    key: kek,
    nonce,
    plaintext: privateKey,
    associatedData: new TextEncoder().encode("pmv2:private-key-wrap:v1"),
  });
  return { nonce, encryptedPrivateKey } as any;
}

/**
 * Decrypt the private key with the user's KEK.
 */
export function decryptPrivateKey(
  encryptedPrivateKey: Uint8Array,
  nonce: Uint8Array,
  kek: Uint8Array,
  aead: XChaCha20Poly1305Aead,
): Uint8Array {
  return aead.decrypt({
    key: kek,
    nonce,
    ciphertext: encryptedPrivateKey,
    associatedData: new TextEncoder().encode("pmv2:private-key-wrap:v1"),
  });
}

/**
 * Compute shared secret via X25519 ECDH and wrap a DEK for the recipient.
 */
export async function wrapDekForRecipient(input: {
  dek: Uint8Array;
  recipientPublicKey: Uint8Array;
  senderPrivateKey: Uint8Array;
  aead: XChaCha20Poly1305Aead;
}): Promise<{ wrappedDek: Uint8Array; wrapNonce: Uint8Array }> {
  const mod = await import("@stablelib/x25519");
  const sharedSecret = mod.sharedKey(input.senderPrivateKey, input.recipientPublicKey);

  const wrapNonce = randomBytes(input.aead.nonceLength);
  const wrappedDek = input.aead.encrypt({
    key: sharedSecret,
    nonce: wrapNonce,
    plaintext: input.dek,
    associatedData: new TextEncoder().encode(SHARE_DEK_WRAP_AAD),
  });

  return { wrappedDek, wrapNonce };
}

/**
 * Unwrap a DEK from a share using X25519 ECDH shared secret.
 */
export async function unwrapDekFromShare(input: {
  wrappedDek: Uint8Array;
  wrapNonce: Uint8Array;
  senderPublicKey: Uint8Array;
  recipientPrivateKey: Uint8Array;
  aead: XChaCha20Poly1305Aead;
}): Promise<Uint8Array> {
  const mod = await import("@stablelib/x25519");
  const sharedSecret = mod.sharedKey(input.recipientPrivateKey, input.senderPublicKey);

  return input.aead.decrypt({
    key: sharedSecret,
    nonce: input.wrapNonce,
    ciphertext: input.wrappedDek,
    associatedData: new TextEncoder().encode(SHARE_DEK_WRAP_AAD),
  });
}
