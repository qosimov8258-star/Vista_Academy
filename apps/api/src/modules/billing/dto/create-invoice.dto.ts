import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, Matches, Min } from "class-validator";

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ example: 850000, description: "Chegirmadan oldingi to'liq summa" })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 85000, description: "Chegirma summasi (masalan ko'p farzandli oila uchun)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiProperty({ example: "2026-09", description: "Davr (YYYY-MM)" })
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @ApiProperty({ example: "2026-09-10" })
  @IsDateString()
  dueDate!: string;
}
