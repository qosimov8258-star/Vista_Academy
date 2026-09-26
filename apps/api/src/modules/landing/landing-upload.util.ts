import { mkdirSync } from "fs";
import { extname } from "path";
import { randomUUID } from "crypto";
import { BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { LANDING_UPLOAD_DIR } from "../../common/constants/uploads";

const PHOTO_MIME_PATTERN = /^image\/(jpeg|png|webp|gif)$/;
const PHOTO_MAX_SIZE = 5 * 1024 * 1024;

/** Lending sahifa rasmlari (o'qituvchi, taom, guruh, kontent blok) uchun bitta umumiy yuklash sozlamasi. */
export const landingPhotoUploadInterceptor = () =>
  FileInterceptor("file", {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        mkdirSync(LANDING_UPLOAD_DIR, { recursive: true });
        cb(null, LANDING_UPLOAD_DIR);
      },
      filename: (_req, file, cb) => {
        cb(null, `${randomUUID()}${extname(file.originalname) || ".jpg"}`);
      },
    }),
    limits: { fileSize: PHOTO_MAX_SIZE },
    fileFilter: (_req, file, cb) => {
      if (!PHOTO_MIME_PATTERN.test(file.mimetype)) {
        cb(new BadRequestException("Faqat rasm fayllari qabul qilinadi (jpeg, png, webp, gif)"), false);
        return;
      }
      cb(null, true);
    },
  });
