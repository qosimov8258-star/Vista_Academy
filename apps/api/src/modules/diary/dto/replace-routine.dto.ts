import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DiaryActivityKind, Weekday } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { DIARY_LIMITS, TIME_REGEX } from "../diary.constants";

export class RoutineItemDto {
  @ApiPropertyOptional({ description: "Mavjud bandni yangilash uchun; yangi band uchun yuborilmaydi" })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: "09:00" })
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  startTime!: string;

  @ApiPropertyOptional({ example: "09:30", nullable: true })
  @IsOptional()
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  endTime?: string | null;

  @ApiProperty({ example: "Matematika" })
  @IsString()
  @MinLength(1)
  @MaxLength(DIARY_LIMITS.titleMaxLength)
  title!: string;

  @ApiProperty({ enum: DiaryActivityKind })
  @IsEnum(DiaryActivityKind)
  kind!: DiaryActivityKind;

  @ApiProperty({ enum: Weekday, isArray: true, example: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] })
  @IsArray()
  @ArrayMinSize(1, { message: "Kamida bitta kun tanlang" })
  @ArrayUnique()
  @IsEnum(Weekday, { each: true })
  weekdays!: Weekday[];
}

/** Shablon butunligicha almashtiriladi: ro'yxatda yo'q bandlar o'chiriladi. */
export class ReplaceRoutineDto {
  @ApiProperty({ type: [RoutineItemDto] })
  @IsArray()
  @ArrayMaxSize(DIARY_LIMITS.routineMaxItems)
  @ValidateNested({ each: true })
  @Type(() => RoutineItemDto)
  items!: RoutineItemDto[];
}
