/**
 * Cloudflare R2 (S3-mos) sozlamalari. `R2_*` o'zgaruvchilaridan biri bo'lsa-da
 * yo'q bo'lsa — funksiya `null` qaytaradi va chaqiruvchi eski usulda (bazada
 * Bytes) davom etadi.
 *
 * `R2_PUBLIC_URL` ataylab bu yerda o'qilmaydi: fayllar hech qachon ochiq
 * havola bilan berilmaydi, faqat qisqa muddatli imzolangan havola orqali.
 */
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  keyPrefix: string;
}

export function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    keyPrefix: process.env.R2_KEY_PREFIX?.trim() ?? "",
  };
}
