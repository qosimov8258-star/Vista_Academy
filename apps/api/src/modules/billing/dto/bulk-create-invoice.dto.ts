import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, Matches, Min } from "class-validator";

export class BulkCreateInvoiceDto {
  @ApiPropertyOptional({ description: "Berilsa — faqat shu guruhdagi bolalar, bo'lmasa — butun filial" })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({ example: 850000, description: "Chegirmadan oldingi to'liq summa — har bir bolaga bir xil" })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 85000 })
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
