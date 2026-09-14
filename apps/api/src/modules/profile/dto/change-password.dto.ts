import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ description: "Joriy parol — egasi ekanini tasdiqlash uchun" })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ example: "YangiParol123!" })
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  @Matches(/[A-Z]/, { message: "Parolda kamida bitta bosh harf bo'lishi kerak" })
  @Matches(/[^A-Za-z0-9]/, { message: "Parolda kamida bitta maxsus belgi bo'lishi kerak" })
  newPassword!: string;
}
