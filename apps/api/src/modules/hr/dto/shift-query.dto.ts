import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ShiftQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ example: "2026-09", description: "Davr (YYYY-MM), bo'sh qoldirilsa joriy oy" })
  @IsOptional()
  @IsString()
  period?: string;
}
