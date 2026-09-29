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
