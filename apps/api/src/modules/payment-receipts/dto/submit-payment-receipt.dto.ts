import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsPositive, IsString, Matches } from "class-validator";

export class SubmitPaymentReceiptDto {
  @ApiProperty({ description: "Ota-ona da'vo qilgan to'lov summasi" })
  @IsNumber()
  @IsPositive()
  amount!: number;

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
