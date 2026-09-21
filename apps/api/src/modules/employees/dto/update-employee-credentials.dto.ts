import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MinLength } from "class-validator";

/** Login/parolni admin to'g'ridan-to'g'ri kiritib o'zgartiradi (avtomatik generatsiyasiz). Ikkalasi ham ixtiyoriy — faqat o'zgargani yuboriladi. */
export class UpdateEmployeeCredentialsDto {
  @ApiPropertyOptional({ example: "dilnoza.yusupova" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/, {
    message: "Login lotin harf, raqam, . _ - dan iborat bo'lishi va kamida 3 belgi bo'lishi kerak",
  })
  login?: string;

  @ApiPropertyOptional({ example: "Ab12345!" })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  @Matches(/[A-Z]/, { message: "Parolda kamida bitta bosh harf bo'lishi kerak" })
  @Matches(/[^A-Za-z0-9]/, { message: "Parolda kamida bitta maxsus belgi bo'lishi kerak" })
  password?: string;
}
