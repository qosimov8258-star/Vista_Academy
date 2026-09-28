import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, IsUrl, MinLength } from "class-validator";
import { OrganizationStatus } from "@prisma/client";

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ nullable: true, description: "null yuborilsa tozalanadi" })
  @IsOptional()
  @IsString()
  contactName?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "null yuborilsa tozalanadi" })
  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "null yuborilsa tozalanadi" })
  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "null yuborilsa tozalanadi" })
  @IsOptional()
  @IsUrl({}, { message: "To'g'ri havola kiriting (masalan https://... bilan boshlansin)" })
  lendingUrl?: string | null;

  @ApiPropertyOptional({ enum: OrganizationStatus })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}
