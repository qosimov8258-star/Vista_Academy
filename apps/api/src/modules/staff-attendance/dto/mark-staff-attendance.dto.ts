import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { EmployeeAttendanceStatus } from "@prisma/client";

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
