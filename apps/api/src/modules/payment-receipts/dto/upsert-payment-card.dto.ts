import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

/** Bo'shliq va chiziqchalarni olib tashlaydi — "8600 1234 ..." ham, "8600-1234-..." ham qabul qilinadi. */
const stripCardSeparators = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.replace(/[\s-]/g, "") : value;

export class UpsertPaymentCardDto {
  @ApiProperty({ example: "8600123412341234", description: "To'liq 16 xonali karta raqami" })
  @Transform(stripCardSeparators)
  @IsString()
  @Matches(/^\d{16}$/, { message: "Karta raqami 16 ta raqamdan iborat bo'lishi kerak" })
  cardNumber!: string;

  @ApiProperty({ example: "ISMOILOV ALISHER", description: "Karta egasining ismi" })
  @IsString()
  @MinLength(2, { message: "Karta egasining ismini kiriting" })
  @MaxLength(80)
  holderName!: string;

  @ApiPropertyOptional({ example: "Xalq banki" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  bankName?: string;

  @ApiPropertyOptional({ description: "Ota-onaga ko'rsatiladigan izoh" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
