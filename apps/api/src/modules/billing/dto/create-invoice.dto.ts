import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, Matches } from "class-validator";
import { DiscountAmount, MoneyAmount } from "./money";

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ example: 850000, description: "Chegirmadan oldingi to'liq summa" })
  @MoneyAmount()
  amount!: number;

  @ApiPropertyOptional({ example: 85000, description: "Chegirma summasi (masalan ko'p farzandli oila uchun)" })
  @IsOptional()
  @DiscountAmount()
  discountAmount?: number;

  @ApiProperty({ example: "2026-09", description: "Davr (YYYY-MM)" })
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @ApiProperty({ example: "2026-09-10" })
  @IsDateString()
  dueDate!: string;
}
