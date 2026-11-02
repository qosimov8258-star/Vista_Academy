import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { MoneyAmount } from "../../billing/dto/money";

export class SubmitPaymentReceiptDto {
  @ApiProperty({ description: "Ota-ona da'vo qilgan to'lov summasi" })
  @MoneyAmount()
  amount!: number;

  @ApiPropertyOptional({ description: "Ota-onaning izohi — moliyachi chek bilan birga ko'radi" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  @ApiProperty({
    description: "data:image/... ko'rinishidagi base64 chek surati (brauzerda kichraytiriladi)",
    example: "data:image/jpeg;base64,/9j/4AAQ...",
  })
  @IsString()
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: "Rasm formati qo'llab-quvvatlanmaydi (jpeg, png yoki webp bo'lishi kerak)",
  })
  image!: string;
}
