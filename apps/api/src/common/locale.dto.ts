import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

/** admin-web i18n/config.ts dagi `locales` bilan bir xil bo'lishi shart */
export const ACCOUNT_LOCALES = ["uz", "ru", "en"] as const;
export type AccountLocale = (typeof ACCOUNT_LOCALES)[number];

export class UpdateLocaleDto {
  @ApiProperty({ description: "Panel/kabinet tili", enum: ACCOUNT_LOCALES, example: "ru" })
  @IsIn(ACCOUNT_LOCALES, { message: "Til noto'g'ri: uz, ru yoki en bo'lishi kerak" })
  locale!: AccountLocale;
}
