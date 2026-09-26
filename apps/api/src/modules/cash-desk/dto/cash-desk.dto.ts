import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from "class-validator";

export class CreateExpenseDto {
  @ApiProperty({ example: "2026-09-19" })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 150000 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: "Xo'jalik" })
  @IsString()
  @MinLength(2)
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CloseCashDto {
  @ApiProperty({ example: "2026-09-19" })
  @IsDateString()
  date!: string;

  @ApiProperty({ description: "Kassir kassada sanagan naqd pul", example: 1200000 })
  @IsNumber()
  @Min(0)
  countedCash!: number;

  @ApiPropertyOptional({ description: "Farq bo'lsa sababi" })
  @IsOptional()
  @IsString()
  note?: string;
}
