import { join } from "path";

export const UPLOADS_ROOT = join(process.cwd(), "uploads");
export const AVATAR_UPLOAD_DIR = join(UPLOADS_ROOT, "avatars");
export const LANDING_UPLOAD_DIR = join(UPLOADS_ROOT, "landing");
