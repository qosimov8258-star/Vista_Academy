import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { AttendanceStatus } from "@prisma/client";

export class MarkAttendanceDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ example: "2026-09-06" })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
