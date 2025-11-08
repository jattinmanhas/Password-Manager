/**
 * Example Encryption Utilities
 * 
 * This is a reference implementation showing how client-side encryption
 * would work. In production, use well-tested libraries like:
 * - Web Crypto API (browser)
 * - crypto (Node.js)
 * - react-native-crypto (React Native)
 */

import * as crypto from 'crypto';

// Constants
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits for AES-256
const SALT_LENGTH = 32;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits for GCM tag

/**
 * Generate a random salt
 */
export function generateSalt(): Buffer {
  return crypto.randomBytes(SALT_LENGTH);
}

/**
 * Derive encryption key from master password using PBKDF2
 * @param masterPassword - User's master password
 * @param salt - Random salt (stored per user, not secret)
 * @returns Derived encryption key
 */
export async function deriveKey(
  masterPassword: string,
  salt: Buffer
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      masterPassword,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256',
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
}

/**
 * Encrypt data using AES-256-GCM
 * @param plaintext - Data to encrypt
 * @param key - Encryption key (derived from master password)
 * @returns Encrypted data with IV and auth tag
 */
export async function encrypt(
  plaintext: string,
  key: Buffer
): Promise<{ iv: string; ciphertext: string; tag: string }> {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    ciphertext: ciphertext,
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt data using AES-256-GCM
 * @param encrypted - Encrypted data with IV and tag
 * @param key - Encryption key (derived from master password)
 * @returns Decrypted plaintext
 */
export async function decrypt(
  encrypted: { iv: string; ciphertext: string; tag: string },
  key: Buffer
): Promise<string> {
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Hash master password for storage (using bcrypt)
 * This is stored on server for authentication
 * @param masterPassword - User's master password
 * @returns Hashed password
 */
export async function hashMasterPassword(
  masterPassword: string
): Promise<string> {
  // In production, use bcrypt library
  // const bcrypt = require('bcrypt');
  // return await bcrypt.hash(masterPassword, 12);
  
  // This is just an example - use proper bcrypt in production
  return crypto
    .createHash('sha256')
    .update(masterPassword)
    .digest('hex');
}

/**
 * Verify master password against stored hash
 * @param masterPassword - User's master password
 * @param hash - Stored password hash
 * @returns True if password matches
 */
export async function verifyMasterPassword(
  masterPassword: string,
  hash: string
): Promise<boolean> {
  // In production, use bcrypt library
  // const bcrypt = require('bcrypt');
  // return await bcrypt.compare(masterPassword, hash);
  
  // This is just an example - use proper bcrypt in production
  const computedHash = crypto
    .createHash('sha256')
    .update(masterPassword)
    .digest('hex');
  return computedHash === hash;
}

/**
 * Generate a secure random password
 * @param length - Password length (default: 20)
 * @param options - Password generation options
 * @returns Generated password
 */
export function generatePassword(
  length: number = 20,
  options: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  } = {}
): string {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
  } = options;

  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let charset = '';
  if (includeUppercase) charset += uppercase;
  if (includeLowercase) charset += lowercase;
  if (includeNumbers) charset += numbers;
  if (includeSymbols) charset += symbols;

  if (charset.length === 0) {
    throw new Error('At least one character set must be enabled');
  }

  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  return password;
}

/**
 * Calculate password strength score
 * @param password - Password to analyze
 * @returns Strength score (0-100)
 */
export function calculatePasswordStrength(password: string): number {
  let score = 0;

  // Length bonus
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 10;

  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;

  // Complexity
  const uniqueChars = new Set(password).size;
  score += Math.min(uniqueChars / password.length * 20, 20);

  return Math.min(score, 100);
}


