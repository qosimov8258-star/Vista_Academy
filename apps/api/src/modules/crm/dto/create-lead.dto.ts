import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { AgeGroup, LeadSource } from "@prisma/client";

export class CreateLeadDto {
  @ApiProperty({ example: "Aliyev Sardor" })
  @IsString()
  @MinLength(2)
  childFullName!: string;

  @ApiPropertyOptional({ example: "2022-03-10" })
  @IsOptional()
  @IsDateString()
  childBirthDate?: string;

  @ApiPropertyOptional({ enum: AgeGroup })
  @IsOptional()
  @IsEnum(AgeGroup)
  ageGroup?: AgeGroup;

  @ApiProperty({ example: "Aziza Karimova" })
  @IsString()
  @MinLength(2)
  parentName!: string;

  @ApiProperty({ example: "+998901234567" })
  @IsString()
  parentPhone!: string;

  @ApiPropertyOptional({ enum: LeadSource, default: "OTHER" })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;
}
