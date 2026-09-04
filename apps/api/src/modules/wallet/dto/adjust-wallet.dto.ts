import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { WalletTransactionType } from "@prisma/client";

const ADJUSTABLE_TYPES = [
  WalletTransactionType.BONUS,
  WalletTransactionType.ADJUSTMENT,
  WalletTransactionType.REFUND,
] as const;

export class AdjustWalletDto {
  @ApiProperty({ enum: ADJUSTABLE_TYPES })
  @IsEnum(ADJUSTABLE_TYPES)
  type!: (typeof ADJUSTABLE_TYPES)[number];

  @ApiProperty({ example: -150000, description: "Musbat (qo'shish) yoki manfiy (ayirish) summa" })
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
