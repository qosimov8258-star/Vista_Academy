import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsUrl, Matches, MinLength } from "class-validator";
import { LOGIN_PATTERN, LOGIN_PATTERN_MESSAGE } from "../../../common/validators/login";

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

  @ApiPropertyOptional({
    example: "https://quyoshcha-bogcha.uz",
    description: "Tashkilotning o'z tashqi lending (marketing) sahifasi — bo'lmasa 'Tez orada' ko'rsatiladi",
  })
  @IsOptional()
  @IsUrl({}, { message: "To'g'ri havola kiriting (masalan https://... bilan boshlansin)" })
  lendingUrl?: string;

  @ApiProperty({ description: "Tarif reja ID — bog'cha yaratilishi bilan shu tarifga obuna ochiladi" })
  @IsString()
  planId!: string;

  @ApiProperty({ example: "Aziza Karimova", description: "Tashkilotning Super Admin akkaunti to'liq ismi" })
  @IsString()
  @MinLength(2)
  adminFullName!: string;

  @ApiProperty({ example: "admin_quyoshcha", description: "Super Admin login (tashkilot doirasida unikal)" })
  @IsString()
  @Matches(LOGIN_PATTERN, { message: LOGIN_PATTERN_MESSAGE })
  adminLogin!: string;

  @ApiProperty({ example: "ChangeMe123!", description: "Super Admin login paroli" })
  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
