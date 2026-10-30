import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, Matches } from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class RecordPaymentDto {
  @ApiProperty()
  @IsString()
  invoiceId!: string;

  @ApiPropertyOptional({ description: "Bo'sh qoldirilsa hisob-fakturaning qolgan qarzi to'liq to'langan deb hisoblanadi" })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: "CASH" })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: "To'lov sanasi (YYYY-MM-DD, Toshkent). Bo'sh — bugun; o'tgan kun 1 oygacha orqaga" })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: "To'lov sanasi noto'g'ri (YYYY-MM-DD)" })
  paidOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
