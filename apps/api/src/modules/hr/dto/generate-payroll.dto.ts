import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Matches, Min } from "class-validator";

export class GeneratePayrollDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty({ example: "2026-09" })
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusAmount?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  penaltyAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
