import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class UpdateOrganizationLogoDto {
  @ApiProperty({
    description: "data:image/... ko'rinishidagi base64 rasm (brauzerda 512x512 kvadratga sig'diriladi)",
    example: "data:image/png;base64,iVBORw0KGgo...",
  })
  @IsString()
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, {
    message: "Rasm formati qo'llab-quvvatlanmaydi (jpeg, png yoki webp bo'lishi kerak)",
  })
  image!: string;
}
