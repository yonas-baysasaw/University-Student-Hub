import crypto from 'node:crypto';
import { ENV } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey() {
  const secret = String(ENV.SESSION_SECRET || '').trim();
  if (!secret) {
    throw new Error('SESSION_SECRET is required to encrypt Gemini API keys.');
  }
  return crypto.scryptSync(secret, 'ush-gemini-key-v1', KEY_LENGTH);
}

export function isValidGeminiKeyFormat(key) {
  const trimmed = String(key || '').trim();
  return trimmed.startsWith('AIza') && trimmed.length >= 20;
}

export function encryptGeminiApiKey(plainKey) {
  const plain = String(plainKey || '').trim();
  if (!isValidGeminiKeyFormat(plain)) {
    throw new Error('Invalid Gemini API key format.');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptGeminiApiKey(cipherText) {
  if (!cipherText) return '';
  try {
    const data = Buffer.from(String(cipherText), 'base64');
    if (data.length <= IV_LENGTH + AUTH_TAG_LENGTH) return '';
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const plain = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
    return plain;
  } catch {
    return '';
  }
}
