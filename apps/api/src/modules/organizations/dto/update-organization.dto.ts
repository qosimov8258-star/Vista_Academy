import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
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

  @ApiPropertyOptional({ enum: OrganizationStatus })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}
