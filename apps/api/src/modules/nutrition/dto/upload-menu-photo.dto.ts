import { ApiProperty } from "@nestjs/swagger";
import { MenuMeal } from "@prisma/client";
import { IsDateString, IsEnum, IsString, Matches } from "class-validator";

export class UploadMenuPhotoDto {
  @ApiProperty({ example: "2026-09-26" })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: MenuMeal, example: MenuMeal.LUNCH })
  @IsEnum(MenuMeal, { message: "Ovqat turi noto'g'ri" })
  meal!: MenuMeal;

  @ApiProperty({
    description: "data:image/... ko'rinishidagi base64 surat (brauzerda kichraytiriladi)",
    example: "data:image/jpeg;base64,/9j/4AAQ...",
  })
  @IsString()
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: "Rasm formati qo'llab-quvvatlanmaydi (jpeg, png yoki webp bo'lishi kerak)",
  })
  image!: string;
}
