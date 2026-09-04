import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsPositive, IsString } from "class-validator";

export class TopUpWalletDto {
  @ApiProperty({ example: 5000000, description: "Musbat summa (UZS)" })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: "Bank o'tkazmasi, shartnoma #145" })
  @IsOptional()
  @IsString()
  note?: string;
}
