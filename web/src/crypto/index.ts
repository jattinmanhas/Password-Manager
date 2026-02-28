export interface Argon2idParams {
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  outputLength: number;
}

export interface Argon2idKdf {
  deriveKey(input: {
    password: Uint8Array;
    salt: Uint8Array;
    params: Argon2idParams;
  }): Promise<Uint8Array>;
}

export interface XChaCha20Poly1305Aead {
  readonly keyLength: number;
  readonly nonceLength: number;
  encrypt(input: {
    key: Uint8Array;
    nonce: Uint8Array;
    plaintext: Uint8Array;
    associatedData?: Uint8Array;
  }): Uint8Array;
  decrypt(input: {
    key: Uint8Array;
    nonce: Uint8Array;
    ciphertext: Uint8Array;
    associatedData?: Uint8Array;
  }): Uint8Array;
}

export interface DerivedMasterKey {
  key: Uint8Array;
  salt: Uint8Array;
  params: Argon2idParams;
}

export interface EncryptedVaultItem {
  version: "xchacha20poly1305-v1";
  nonce: string;
  ciphertext: string;
  wrappedDek: string;
  wrapNonce: string;
}

const DEFAULT_ARGON2ID_PARAMS: Argon2idParams = {
  memoryKiB: 64 * 1024,
  iterations: 3,
  parallelism: 2,
  outputLength: 32,
};
const MASTER_KEY_SALT_LENGTH = 16;
const MAX_RANDOM_VALUES_CHUNK = 65_536;
const DEK_WRAP_AAD = "pmv2:dek-wrap:v1";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function validateArgon2idParams(params: Argon2idParams): void {
  assertPositiveInteger(params.memoryKiB, "argon2 memoryKiB");
  assertPositiveInteger(params.iterations, "argon2 iterations");
  assertPositiveInteger(params.parallelism, "argon2 parallelism");
  assertPositiveInteger(params.outputLength, "argon2 outputLength");
}

function isValidBase64(input: string): boolean {
  if (input.length === 0 || input.length % 4 !== 0) {
    return false;
  }
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input);
}

function decodeBase64Field(input: string, field: string, expectedLength?: number): Uint8Array {
  const decoded = fromBase64(input);
  if (expectedLength !== undefined && decoded.length !== expectedLength) {
    throw new Error(`${field} must decode to ${expectedLength} bytes`);
  }
  return decoded;
}

export function utf8ToBytes(value: string): Uint8Array {
  return encoder.encode(value);
}

export function bytesToUtf8(value: Uint8Array): string {
  return decoder.decode(value);
}

export function randomBytes(length: number): Uint8Array {
  assertPositiveInteger(length, "random byte length");

  const cryptoObject = globalThis.crypto;
  if (!cryptoObject?.getRandomValues) {
    throw new Error("Web Crypto API unavailable");
  }

  const out = new Uint8Array(length);
  for (let offset = 0; offset < out.length; offset += MAX_RANDOM_VALUES_CHUNK) {
    const end = Math.min(offset + MAX_RANDOM_VALUES_CHUNK, out.length);
    cryptoObject.getRandomValues(out.subarray(offset, end));
  }
  return out;
}

export async function deriveMasterKey(input: {
  password: string;
  kdf: Argon2idKdf;
  salt?: Uint8Array;
  params?: Partial<Argon2idParams>;
}): Promise<DerivedMasterKey> {
  if (typeof input.password !== "string" || input.password.length === 0) {
    throw new Error("password must be a non-empty string");
  }

  const params: Argon2idParams = {
    ...DEFAULT_ARGON2ID_PARAMS,
    ...input.params,
  };
  validateArgon2idParams(params);

  const salt = input.salt ?? randomBytes(MASTER_KEY_SALT_LENGTH);
  if (salt.length !== MASTER_KEY_SALT_LENGTH) {
    throw new Error(`salt must be ${MASTER_KEY_SALT_LENGTH} bytes`);
  }

  const key = await input.kdf.deriveKey({
    password: utf8ToBytes(input.password),
    salt,
    params,
  });

  if (key.length !== params.outputLength) {
    throw new Error("derived key length mismatch");
  }

  return { key, salt, params };
}

export function encryptVaultItem(input: {
  plaintext: string;
  kek: Uint8Array;
  aead: XChaCha20Poly1305Aead;
  associatedData?: Uint8Array;
}): EncryptedVaultItem {
  if (input.kek.length !== input.aead.keyLength) {
    throw new Error("kek length does not match cipher key length");
  }

  const itemDek = randomBytes(input.aead.keyLength);
  try {
    const nonce = randomBytes(input.aead.nonceLength);
    const wrapNonce = randomBytes(input.aead.nonceLength);

    const ciphertext = input.aead.encrypt({
      key: itemDek,
      nonce,
      plaintext: utf8ToBytes(input.plaintext),
      associatedData: input.associatedData,
    });

    const wrappedDek = input.aead.encrypt({
      key: input.kek,
      nonce: wrapNonce,
      plaintext: itemDek,
      associatedData: utf8ToBytes(DEK_WRAP_AAD),
    });

    return {
      version: "xchacha20poly1305-v1",
      nonce: toBase64(nonce),
      ciphertext: toBase64(ciphertext),
      wrappedDek: toBase64(wrappedDek),
      wrapNonce: toBase64(wrapNonce),
    };
  } finally {
    itemDek.fill(0);
  }
}

export function decryptVaultItem(input: {
  payload: EncryptedVaultItem;
  kek: Uint8Array;
  aead: XChaCha20Poly1305Aead;
  associatedData?: Uint8Array;
}): string {
  if (input.payload.version !== "xchacha20poly1305-v1") {
    throw new Error("unsupported vault item version");
  }
  if (input.kek.length !== input.aead.keyLength) {
    throw new Error("kek length does not match cipher key length");
  }
  if (!input.payload.nonce || !input.payload.wrapNonce || !input.payload.ciphertext || !input.payload.wrappedDek) {
    throw new Error("payload is missing required encrypted fields");
  }

  const wrapNonce = decodeBase64Field(input.payload.wrapNonce, "wrapNonce", input.aead.nonceLength);
  const wrappedDek = decodeBase64Field(input.payload.wrappedDek, "wrappedDek");
  const nonce = decodeBase64Field(input.payload.nonce, "nonce", input.aead.nonceLength);
  const ciphertext = decodeBase64Field(input.payload.ciphertext, "ciphertext");

  const itemDek = input.aead.decrypt({
    key: input.kek,
    nonce: wrapNonce,
    ciphertext: wrappedDek,
    associatedData: utf8ToBytes(DEK_WRAP_AAD),
  });
  if (itemDek.length !== input.aead.keyLength) {
    throw new Error("wrapped DEK has unexpected key length");
  }

  const plaintext = input.aead.decrypt({
    key: itemDek,
    nonce,
    ciphertext,
    associatedData: input.associatedData,
  });

  return bytesToUtf8(plaintext);
}

export function toBase64(input: Uint8Array): string {
  const maybeBuffer = (globalThis as { Buffer?: { from(value: Uint8Array): { toString(encoding: string): string } } }).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(input).toString("base64");
  }
  let raw = "";
  for (const byte of input) {
    raw += String.fromCharCode(byte);
  }
  return btoa(raw);
}

export function fromBase64(input: string): Uint8Array {
  if (!isValidBase64(input)) {
    throw new Error("invalid base64 input");
  }

  const maybeBuffer = (globalThis as { Buffer?: { from(value: string, encoding: string): Uint8Array } }).Buffer;
  if (maybeBuffer) {
    return new Uint8Array(maybeBuffer.from(input, "base64"));
  }
  const raw = atob(input);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}
