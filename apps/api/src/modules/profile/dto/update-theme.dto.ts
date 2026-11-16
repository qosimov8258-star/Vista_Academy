import { ApiProperty } from "@nestjs/swagger";
import { Matches } from "class-validator";

/** admin-web lib/theme-config.ts dagi THEMES bilan bir xil bo'lishi shart */
export const THEME_COLORS = ["green", "blue", "indigo", "violet", "pink", "orange", "teal", "slate"] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

/** Tayyor rang nomi yoki foydalanuvchi o'zi tanlagan rang («#1a2b3c») */
export const THEME_COLOR_RE = new RegExp(`^(?:${THEME_COLORS.join("|")}|#[0-9a-fA-F]{6})$`);

export class UpdateThemeDto {
  @ApiProperty({ description: "Tayyor rang nomi yoki #rrggbb", example: "blue" })
  @Matches(THEME_COLOR_RE, { message: "Rang noto'g'ri: tayyor rang nomi yoki #rrggbb bo'lishi kerak" })
  themeColor!: string;
}
