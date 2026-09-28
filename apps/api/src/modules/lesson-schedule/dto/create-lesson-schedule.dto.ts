import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEnum, IsOptional, IsString, Matches } from "class-validator";
import { Weekday } from "@prisma/client";

/** "HH:mm", 00:00–23:59. */
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateLessonScheduleDto {
  @ApiProperty()
  @IsString()
  groupId!: string;

  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiPropertyOptional({ example: "Ingliz tili" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    enum: Weekday,
    isArray: true,
    example: ["MONDAY", "WEDNESDAY", "FRIDAY"],
    description: "Dars o'tiladigan hafta kunlari — har bir kun uchun alohida yozuv yaratiladi",
  })
  @IsArray()
  @ArrayNotEmpty({ message: "Kamida bitta hafta kunini tanlang" })
  @ArrayUnique({ message: "Hafta kunlari takrorlanmasligi kerak" })
  @IsEnum(Weekday, { each: true })
  weekdays!: Weekday[];

  @ApiProperty({ example: "09:00" })
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  startTime!: string;

  @ApiProperty({ example: "09:45" })
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  endTime!: string;
}
