import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsString } from "class-validator";

export class LessonAttendanceDayQueryDto {
  @ApiProperty({ description: "Dars jadvali qatori" })
  @IsString()
  scheduleId!: string;

  @ApiProperty({ example: "2026-09-19" })
  @IsDateString()
  date!: string;
}
