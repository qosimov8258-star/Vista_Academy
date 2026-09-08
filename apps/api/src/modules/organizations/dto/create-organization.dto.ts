import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateOrganizationDto {
  @ApiProperty({ example: "Quyoshcha bog'chalar tarmog'i" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: "Birinchi filial nomi", default: "Bosh filial" })
  @IsOptional()
  @IsString()
  firstBranchName?: string;

  @ApiPropertyOptional({ example: "Aziza Karimova" })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ example: "info@quyoshcha.uz" })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({ example: "+998901234567" })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: "Boshlang'ich tarif reja ID (mavjud bo'lsa obuna ochiladi)" })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({ example: "Aziza Karimova", description: "Tashkilotning Super Admin akkaunti to'liq ismi" })
  @IsString()
  @MinLength(2)
  adminFullName!: string;

  @ApiProperty({ example: "admin@quyoshcha.uz", description: "Super Admin login emaili (tashkilot doirasida unikal)" })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: "ChangeMe123!", description: "Super Admin login paroli" })
  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
