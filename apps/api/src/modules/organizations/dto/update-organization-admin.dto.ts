import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MinLength } from "class-validator";
import { LOGIN_PATTERN, LOGIN_PATTERN_MESSAGE } from "../../../common/validators/login";

/**
 * Tashkilot Super Admin kabineti login/parolini qo'lda o'zgartirish uchun —
 * avtomatik generatsiya emas, platform admin qiymatni o'zi kiritadi.
 * Ikkalasi ham ixtiyoriy: faqat berilgan maydon yangilanadi.
 */
export class UpdateOrganizationAdminDto {
  @ApiPropertyOptional({ example: "admin_quyoshcha" })
  @IsOptional()
  @IsString()
  @Matches(LOGIN_PATTERN, { message: LOGIN_PATTERN_MESSAGE })
  login?: string;

  @ApiPropertyOptional({ example: "YangiParol123!" })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  password?: string;
}
