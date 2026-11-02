import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, Matches } from "class-validator";
import { DiscountAmount, MoneyAmount } from "./money";

export class BulkCreateInvoiceDto {
  @ApiPropertyOptional({ description: "Berilsa — faqat shu guruhdagi bolalar, bo'lmasa — butun filial" })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({
    example: 850000,
    description: "Chegirmadan oldingi to'liq summa — har bir bolaga bir xil. Berilmasa — har bola o'z guruhi narxida (bo'lmasa filial narxi)",
  })
  @IsOptional()
  @MoneyAmount()
  amount?: number;

  @ApiPropertyOptional({ example: 85000 })
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
