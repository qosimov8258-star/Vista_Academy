import { createHash, randomBytes } from "crypto";

/** Agent tokeni prefiksi — loglarda yoki .env'da nima ekanini tanib olish uchun. */
const TOKEN_PREFIX = "hik_";

/**
 * Yangi agent tokeni: 32 bayt tasodifiy qiymat. Foydalanuvchiga faqat bir
 * marta ko'rsatiladi, bazaga esa `hashAgentToken` natijasi yoziladi.
 */
export function generateAgentToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/**
 * Token yuqori entropiyali tasodifiy qiymat bo'lgani uchun sekin hash
 * (argon2) shart emas — sha256 yetarli va bazadan unikal indeks orqali
 * bir so'rovda topishga imkon beradi.
 */
export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Ulangan obyekt agentining kaliti — filialdagi barcha qurilmalar uchun bitta. */
export const AGENT_KEY_PREFIX = "hka_";

export function generateAgentKey(): string {
  return `${AGENT_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** Ulash kodi alifbosi — chalkashadigan belgilarsiz (0/O, 1/I/L). */
const PAIRING_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 8 belgili bir martalik ulash kodi, ko'rsatish uchun "XXXX-XXXX". */
export function generatePairingCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => PAIRING_ALPHABET[b % PAIRING_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Foydalanuvchi qanday yozsa ham (kichik harf, chiziqchasiz, bo'shliq) bir xil xesh. */
export function hashPairingCode(code: string): string {
  return hashAgentToken(code.toUpperCase().replace(/[^A-Z0-9]/g, ""));
}
