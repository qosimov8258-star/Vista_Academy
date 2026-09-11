import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Matches } from "class-validator";
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

  @ApiProperty()
  @IsString()
  roomId!: string;

  @ApiPropertyOptional({ example: "Ingliz tili" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ enum: Weekday })
  @IsEnum(Weekday)
  weekday!: Weekday;

  @ApiProperty({ example: "09:00" })
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  startTime!: string;

  @ApiProperty({ example: "09:45" })
  @Matches(TIME_REGEX, { message: "Vaqt HH:mm formatida bo'lishi kerak" })
  endTime!: string;
}
