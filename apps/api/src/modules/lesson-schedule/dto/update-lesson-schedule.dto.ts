import { ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, Matches, ValidateIf } from "class-validator";
import { Weekday } from "@prisma/client";
import { TIME_REGEX } from "./create-lesson-schedule.dto";

export class UpdateLessonScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: "Xona; null — xonasiz", nullable: true, type: String })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  roomId?: string | null;

  @ApiPropertyOptional({ example: "Ingliz tili" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ enum: Weekday })
  @IsOptional()
  @IsEnum(Weekday)
  weekday?: Weekday;

  @ApiPropertyOptional({
    enum: Weekday,
    isArray: true,
    description: "Bir nechta kun: shu dars birinchi kunga o'tadi, qolgan kunlarga nusxasi yaratiladi (hammasi bitta tranzaksiyada)",
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: "Kamida bitta hafta kunini tanlang" })
  @ArrayUnique({ message: "Hafta kunlari takrorlanmasligi kerak" })
  @IsEnum(Weekday, { each: true })
  weekdays?: Weekday[];

  @ApiPropertyOptional({ example: "09:00" })
  @IsOptional()
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  startTime?: string;

  @ApiPropertyOptional({ example: "09:45" })
  @IsOptional()
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  endTime?: string;

  @ApiPropertyOptional({ description: "To'qnashuv bo'lsa ham saqlash («Baribir saqlash»)" })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
