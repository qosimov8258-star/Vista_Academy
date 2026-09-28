import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

/** admin-web lib/theme-config.ts dagi THEMES bilan bir xil bo'lishi shart */
export const THEME_COLORS = ["green", "blue", "indigo", "violet", "pink", "orange", "teal", "slate"] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

export class UpdateThemeDto {
  @ApiProperty({ enum: THEME_COLORS, example: "blue" })
  @IsIn(THEME_COLORS)
  themeColor!: ThemeColor;
}
