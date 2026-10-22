import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength, Min, MinLength } from "class-validator";

/** Hisob-fakturani tuzatish (faqat moliyachi): summa, chegirma, muddat — sabab majburiy */
export class UpdateInvoiceDto {
  @ApiPropertyOptional({ example: 2600000, description: "Chegirmadan oldingi to'liq summa" })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: "2026-10-10" })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ example: "Import xatosi: 2 630 000 emas, 2 600 000" })
  @IsString()
  @MinLength(3, { message: "Sababni yozing (kamida 3 harf)" })
  @MaxLength(300, { message: "Sabab 300 belgidan oshmasin" })
  reason!: string;
}

/** Hisob-fakturani bekor qilish (faqat moliyachi, to'lov tushmagan bo'lsa) */
export class CancelInvoiceDto {
  @ApiProperty({ example: "Bola shu oy bog'chaga kelmadi" })
  @IsString()
  @MinLength(3, { message: "Sababni yozing (kamida 3 harf)" })
  @MaxLength(300, { message: "Sabab 300 belgidan oshmasin" })
  reason!: string;
}
