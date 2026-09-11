import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString, Matches } from "class-validator";
import { EmployeeAttendanceStatus } from "@prisma/client";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class MarkStaffAttendanceDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty({ example: "2026-09-06" })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: EmployeeAttendanceStatus })
  @IsEnum(EmployeeAttendanceStatus)
  status!: EmployeeAttendanceStatus;

  @ApiPropertyOptional({ example: "08:05", description: "HH:MM shaklida" })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: "Vaqt HH:MM shaklida bo'lishi kerak" })
  checkInTime?: string;

  @ApiPropertyOptional({ example: "18:00", description: "HH:MM shaklida" })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: "Vaqt HH:MM shaklida bo'lishi kerak" })
  checkOutTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
