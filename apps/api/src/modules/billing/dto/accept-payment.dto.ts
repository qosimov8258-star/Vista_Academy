import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, Matches, MaxLength } from "class-validator";
import { PaymentMethod } from "@prisma/client";

/**
 * Kassada bola bo'yicha to'lov qabul qilish (bitta forma): summa bolaning
 * ochiq hisob-fakturalarini eng eski oydan boshlab yopadi. Qarz bo'lmasa —
 * `period` oyi uchun oldindan to'lov sifatida yoziladi.
 */
export class AcceptPaymentDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ description: "Qarz yo'q bo'lganda — qaysi oy uchun oldindan to'lov (YYYY-MM)" })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Oy noto'g'ri (YYYY-MM)" })
  period?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({
    description: "Naqddan boshqa usulda majburiy: data:image/... ko'rinishidagi chek surati (brauzerda kichraytiriladi)",
  })
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: "Rasm formati qo'llab-quvvatlanmaydi (jpeg, png yoki webp bo'lishi kerak)",
  })
  receiptImage?: string;
}

export class RefundPaymentDto {
  /** Majburiy (kamida 3 harf) — tekshiruv servisda, bitta aniq xabar bilan */
  @ApiProperty({ description: "Bekor qilish sababi — to'lovda, ledgerda va amallar jurnalida saqlanadi" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
