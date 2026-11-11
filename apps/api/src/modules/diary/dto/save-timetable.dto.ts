import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Matches, MaxLength, ValidateIf, ValidateNested } from "class-validator";
import { DIARY_LIMITS, TIME_REGEX } from "../diary.constants";
import { TIMETABLE_DAYS, TIMETABLE_LIMITS } from "../timetable";

export class TimetableRowDto {
  @ApiProperty({ example: "09:00" })
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  startTime!: string;

  @ApiProperty({ example: "09:30", description: "Bo'sh satr — tugash vaqti ko'rsatilmagan" })
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  endTime!: string;

  @ApiProperty({ type: [String], description: "7 ta katak: Du … Ya; bo'sh satr — mashg'ulot yo'q" })
  @IsArray()
  @ArrayMinSize(TIMETABLE_DAYS.length, { message: `Har qatorda ${TIMETABLE_DAYS.length} ta kun bo'lishi kerak` })
  @ArrayMaxSize(TIMETABLE_DAYS.length, { message: `Har qatorda ${TIMETABLE_DAYS.length} ta kun bo'lishi kerak` })
  @IsString({ each: true })
  @MaxLength(DIARY_LIMITS.titleMaxLength, { each: true, message: `Mashg'ulot nomi ${DIARY_LIMITS.titleMaxLength} belgidan oshmasin` })
  cells!: string[];
}

/** Haftalik jadval butunligicha saqlanadi */
export class SaveTimetableDto {
  @ApiProperty({ type: [TimetableRowDto] })
  @IsArray()
  @ArrayMaxSize(TIMETABLE_LIMITS.rows, { message: `Jadvalda ko'pi bilan ${TIMETABLE_LIMITS.rows} ta qator bo'ladi` })
  @ValidateNested({ each: true })
  @Type(() => TimetableRowDto)
  rows!: TimetableRowDto[];

  @ApiPropertyOptional({ example: "Shanbada mashg'ulotlar 15:00 da tugaydi." })
  @IsOptional()
  @IsString()
  @MaxLength(TIMETABLE_LIMITS.noteMaxLength)
  note?: string;
}
