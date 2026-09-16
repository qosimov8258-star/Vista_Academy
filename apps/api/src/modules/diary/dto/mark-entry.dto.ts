import { ApiPropertyOptional } from "@nestjs/swagger";
import { DiaryActivityKind } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import { DIARY_LIMITS, TIME_REGEX } from "../diary.constants";

/**
 * Mashg'ulotni "bo'ldi" deb belgilash.
 * - Shablondagi band: faqat `routineItemId` (+ ixtiyoriy `note`). Qayta
 *   yuborilsa o'sha kungi belgi yangilanadi, ikkinchisi yaratilmaydi.
 * - Shablonda yo'q voqea: `routineItemId` siz, `startTime` va `title` majburiy.
 */
export class MarkEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  routineItemId?: string;

  @ApiPropertyOptional({ example: "11:00" })
  @IsOptional()
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  startTime?: string;

  @ApiPropertyOptional({ example: "11:30", nullable: true })
  @IsOptional()
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  endTime?: string | null;

  @ApiPropertyOptional({ example: "Teatrga sayohat" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(DIARY_LIMITS.titleMaxLength)
  title?: string;

  @ApiPropertyOptional({ enum: DiaryActivityKind })
  @IsOptional()
  @IsEnum(DiaryActivityKind)
  kind?: DiaryActivityKind;

  @ApiPropertyOptional({ example: "Bolalar 1 dan 10 gacha sanashni o'rgandi" })
  @IsOptional()
  @IsString()
  @MaxLength(DIARY_LIMITS.noteMaxLength)
  note?: string;
}

export class UpdateEntryDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(DIARY_LIMITS.noteMaxLength)
  note?: string | null;

  @ApiPropertyOptional({ example: "11:00" })
  @IsOptional()
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  startTime?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  endTime?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(DIARY_LIMITS.titleMaxLength)
  title?: string;

  @ApiPropertyOptional({ enum: DiaryActivityKind })
  @IsOptional()
  @IsEnum(DiaryActivityKind)
  kind?: DiaryActivityKind;
}
