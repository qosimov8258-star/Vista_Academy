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
}
