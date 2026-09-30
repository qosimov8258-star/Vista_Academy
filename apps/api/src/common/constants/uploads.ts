import { join } from "path";

export const UPLOADS_ROOT = join(process.cwd(), "uploads");
export const AVATAR_UPLOAD_DIR = join(UPLOADS_ROOT, "avatars");
export const LANDING_UPLOAD_DIR = join(UPLOADS_ROOT, "landing");

/** /uploads da rasm deb beriladigan kengaytmalar (qolganlari yuklab olinadi). */
export const UPLOAD_IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif)$/i;

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

/**
 * Saqlanadigan fayl kengaytmasi — mijoz yuborgan nomdan (`x.html`) emas,
 * fileFilter tekshirgan MIME turidan. Aks holda `/uploads` HTML sahifani
 * `text/html` qilib berib yuborardi.
 */
export function imageExtensionForMime(mimetype: string): string {
  return IMAGE_EXTENSION_BY_MIME[mimetype] ?? ".jpg";
}
