import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Gender, GuardianRelation } from "@prisma/client";
import { IsDateString, IsEnum, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateChildDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({ example: "Umaraliyev", description: "Familiya" })
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty({ example: "Usmon", description: "Ism" })
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({ example: "2021-05-14" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  // Bolaning o'z telefoni bo'lmaydi — bog'cha ota-ona bilan aloqaga chiqadi,
  // shuning uchun kamida bitta vasiy majburiy.
  @ApiProperty({ example: "Umaraliyev Aziz" })
  @IsString()
  @MinLength(2)
  guardianFullName!: string;

  @ApiProperty({ example: "+998901234567" })
  @IsString()
  @Matches(/\d[\d\s()+-]{7,}/, { message: "Telefon raqami noto'g'ri" })
  guardianPhone!: string;

  @ApiProperty({ enum: GuardianRelation, example: GuardianRelation.MOTHER })
  @IsEnum(GuardianRelation)
  guardianRelation!: GuardianRelation;

  @ApiPropertyOptional({
    example: "Ab12345!",
    description: "Ota-ona kabineti uchun parol — berilmasa avtomatik generatsiya qilinadi",
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  @Matches(/[A-Z]/, { message: "Parolda kamida bitta bosh harf bo'lishi kerak" })
  @Matches(/[^A-Za-z0-9]/, { message: "Parolda kamida bitta maxsus belgi bo'lishi kerak" })
  guardianPassword?: string;
}
