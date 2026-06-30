import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { deriveMasterKeyWithWorker } from "./worker-client";

/**
 * Client-side authentication verifier derivation.
 *
 * The master password never leaves the browser. Instead we send the server a
 * verifier = Argon2id(masterPassword, authSalt), where authSalt is derived
 * deterministically from the email. The server stores only a fast keyed hash
 * of this verifier.
 *
 * The auth salt is intentionally distinct from the vault KDF salt (which is a
 * random per-user value persisted server-side and embedded in the vault
 * verifier item). Because the two derivations use different salts, the value
 * sent to the server can never reconstruct the vault encryption key (KEK).
 */

const AUTH_SALT_DOMAIN = "pmv2-auth-v1:";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Deterministic 32-byte Argon2id salt for the authentication verifier. */
function authSalt(email: string): Uint8Array {
  return sha256(utf8ToBytes(AUTH_SALT_DOMAIN + normalizeEmail(email)));
}

/**
 * Derives the authentication verifier to send to the server in place of the
 * plaintext master password (used for register, login, and password reset).
 * Returns a 64-char lowercase hex string (a 32-byte Argon2id output).
 */
export async function deriveAuthVerifier(email: string, masterPassword: string): Promise<string> {
  const derived = await deriveMasterKeyWithWorker({
    password: masterPassword,
    salt: authSalt(email),
  });
  try {
    return bytesToHex(derived.key);
  } finally {
    derived.key.fill(0);
  }
}
