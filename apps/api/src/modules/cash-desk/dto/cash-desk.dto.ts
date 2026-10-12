import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { PaymentMethod } from "@prisma/client";
import { EXPENSE_CATEGORIES } from "../expense-categories";

export class CreateExpenseDto {
  @ApiProperty({ example: "2026-09-19" })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 150000 })
  @IsNumber()
  @IsPositive({ message: "Summa 0 dan katta bo'lishi kerak" })
  @Max(10_000_000_000)
  amount!: number;

  @ApiProperty({ enum: EXPENSE_CATEGORIES, example: "Oziq-ovqat" })
  @IsIn(EXPENSE_CATEGORIES, { message: "Xarajat turkumi noto'g'ri" })
  category!: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: "CASH", description: "Faqat naqd xarajat kassadagi naqdni kamaytiradi" })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    description: "Naqddan boshqa usulda majburiy: data:image/... ko'rinishidagi chek surati (tahrirlashda — faqat almashtirilsa)",
  })
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: "Rasm formati qo'llab-quvvatlanmaydi (jpeg, png yoki webp bo'lishi kerak)",
  })
  receiptImage?: string;
}

/** Tahrirlash — to'liq almashtirish (yaratishdagi bilan bir xil maydonlar) */
export class UpdateExpenseDto extends CreateExpenseDto {}

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
