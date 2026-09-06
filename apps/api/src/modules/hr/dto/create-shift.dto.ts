import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateShiftDto {
  @ApiProperty()
  @IsString()
  employeeId!: string;

  @ApiProperty({ example: "2026-09-06" })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 8, description: "Ish soatlari" })
  @IsNumber()
  @Min(0)
  hours!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
