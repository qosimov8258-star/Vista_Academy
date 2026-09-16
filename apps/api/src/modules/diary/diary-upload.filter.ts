import { ArgumentsHost, Catch, PayloadTooLargeException } from "@nestjs/common";
import { HttpExceptionFilter } from "../../common/filters/http-exception.filter";
import { DIARY_LIMITS } from "./diary.constants";

/**
 * Multer chegaradan katta faylni o'zi rad etadi va inglizcha "File too large"
 * qaytaradi. Tarbiyachiga tushunarli xabar bo'lsin — javob shakli esa
 * umumiy filtrniki bilan bir xil qoladi.
 */
@Catch()
export class DiaryUploadFilter extends HttpExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof PayloadTooLargeException) {
      const photoMb = DIARY_LIMITS.photoMaxBytes / 1024 / 1024;
      const videoMb = DIARY_LIMITS.videoMaxBytes / 1024 / 1024;
      return super.catch(
        new PayloadTooLargeException(
          `Fayl juda katta: rasm ${photoMb} MB, video ${videoMb} MB gacha bo'lishi kerak — qisqaroq video tanlang`,
        ),
        host,
      );
    }
    return super.catch(exception, host);
  }
}
