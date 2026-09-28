import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsIn, IsString } from "class-validator";

export class MarkLessonAttendanceDto {
  @ApiProperty({ description: "Dars jadvali qatori" })
  @IsString()
  scheduleId!: string;

  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ example: "2026-09-19" })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: ["PRESENT", "ABSENT"], description: "Keldi / Kelmadi" })
  @IsIn(["PRESENT", "ABSENT"], { message: "Holat faqat 'keldi' yoki 'kelmadi' bo'lishi mumkin" })
  status!: "PRESENT" | "ABSENT";
}
