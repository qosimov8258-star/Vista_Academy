import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class ApprovePaymentReceiptDto {
  @ApiProperty({ enum: PaymentMethod, description: "Moliyachi tanlagan haqiqiy to'lov usuli (Click/Payme/Uzum/Mobil ilova/Bankomat)" })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
