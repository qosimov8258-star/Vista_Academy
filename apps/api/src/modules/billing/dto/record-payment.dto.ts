import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
