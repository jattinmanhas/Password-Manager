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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8ToBytes(value: string): Uint8Array {
  return encoder.encode(value);
}

export function bytesToUtf8(value: Uint8Array): string {
  return decoder.decode(value);
}

export function randomBytes(length: number): Uint8Array {
  if (length <= 0) {
    throw new Error("random byte length must be positive");
  }
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

export async function deriveMasterKey(input: {
  password: string;
  kdf: Argon2idKdf;
  salt?: Uint8Array;
  params?: Partial<Argon2idParams>;
}): Promise<DerivedMasterKey> {
  const params: Argon2idParams = {
    ...DEFAULT_ARGON2ID_PARAMS,
    ...input.params,
  };

  const salt = input.salt ?? randomBytes(16);
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
    associatedData: utf8ToBytes("pmv2:dek-wrap:v1"),
  });

  return {
    version: "xchacha20poly1305-v1",
    nonce: toBase64(nonce),
    ciphertext: toBase64(ciphertext),
    wrappedDek: toBase64(wrappedDek),
    wrapNonce: toBase64(wrapNonce),
  };
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

  const itemDek = input.aead.decrypt({
    key: input.kek,
    nonce: fromBase64(input.payload.wrapNonce),
    ciphertext: fromBase64(input.payload.wrappedDek),
    associatedData: utf8ToBytes("pmv2:dek-wrap:v1"),
  });

  const plaintext = input.aead.decrypt({
    key: itemDek,
    nonce: fromBase64(input.payload.nonce),
    ciphertext: fromBase64(input.payload.ciphertext),
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
