import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Xodim kabineti parolini "Parolni ko'rsatish" funksiyasi uchun qaytarib
 * olinadigan holda saqlash uchun ishlatiladi (auth esa argon2 hash orqali,
 * bu yerga bog'liq emas). Kalit atrof-muhitdan keladi — bazadan tashqarida,
 * shuning uchun baza dump'i yolg'iz o'zi parollarni ochib bermaydi.
 */
function requireEncryptionKey(): Buffer {
  const raw = process.env.EMPLOYEE_SECRET_KEY;
  if (!raw) {
    throw new Error("EMPLOYEE_SECRET_KEY env var is required");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("EMPLOYEE_SECRET_KEY must be a 64-character hex string (32 bytes)");
  }
  return key;
}

/**
 * Natija: [iv(12) | authTag(16) | ciphertext] — bitta ustunda saqlanadi.
 * Yangi `ArrayBuffer`ga tayangan `Uint8Array` qaytariladi (`Buffer.concat`
 * emas) — Prisma'ning `Bytes` maydoni aynan shu generic turni kutadi.
 */
export function encryptSecret(plainText: string): Uint8Array<ArrayBuffer> {
  const key = requireEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const out = new Uint8Array(iv.length + authTag.length + ciphertext.length);
  out.set(iv, 0);
  out.set(authTag, iv.length);
  out.set(ciphertext, iv.length + authTag.length);
  return out;
}

export function decryptSecret(payload: Uint8Array): string {
  const key = requireEncryptionKey();
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
