import { GroupMaterialKind } from "@prisma/client";

export const MATERIAL_LIMITS = {
  /** Bazada saqlanganda ham, R2 da ham — bitta fayl uchun */
  maxBytes: 20 * 1024 * 1024,
  titleMaxLength: 120,
  descriptionMaxLength: 1000,
} as const;

/** Ruxsat etilgan turlar: mimetype -> guruh (rasm, video, hujjat) */
export const MATERIAL_MIME_KINDS: Record<string, GroupMaterialKind> = {
  "image/jpeg": GroupMaterialKind.IMAGE,
  "image/png": GroupMaterialKind.IMAGE,
  "image/webp": GroupMaterialKind.IMAGE,
  "video/mp4": GroupMaterialKind.VIDEO,
  "video/webm": GroupMaterialKind.VIDEO,
  "video/quicktime": GroupMaterialKind.VIDEO,
  "application/pdf": GroupMaterialKind.DOCUMENT,
  "application/msword": GroupMaterialKind.DOCUMENT,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": GroupMaterialKind.DOCUMENT,
  "application/vnd.ms-excel": GroupMaterialKind.DOCUMENT,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": GroupMaterialKind.DOCUMENT,
  "application/vnd.ms-powerpoint": GroupMaterialKind.DOCUMENT,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": GroupMaterialKind.DOCUMENT,
  "text/plain": GroupMaterialKind.DOCUMENT,
};
