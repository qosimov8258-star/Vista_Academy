import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MinLength } from "class-validator";

export class CreateLandingApplicationDto {
  @ApiProperty({ example: "Dilnoza Qosimova" })
  @IsString()
  @MinLength(2, { message: "Ismingizni to'liq kiriting" })
  fullName!: string;

  /** Frontend raqamni +998XXXXXXXXX ko'rinishiga normallashtirib yuboradi. */
  @ApiProperty({ example: "+998901234567" })
  @IsString()
  @Matches(/^\+998\d{9}$/, { message: "Telefon raqami noto'g'ri. Namuna: +998 90 123 45 67" })
  phone!: string;
}
