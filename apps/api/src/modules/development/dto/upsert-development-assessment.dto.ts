import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Matches } from "class-validator";
import { DevelopmentRating } from "@prisma/client";

export class UpsertDevelopmentAssessmentDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ example: "2026-09", description: "Davr (YYYY-MM)" })
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @ApiPropertyOptional({ enum: DevelopmentRating, description: "Nutq" })
  @IsOptional()
  @IsEnum(DevelopmentRating)
  speechRating?: DevelopmentRating;

  @ApiPropertyOptional({ enum: DevelopmentRating, description: "Motorika" })
  @IsOptional()
  @IsEnum(DevelopmentRating)
  motorRating?: DevelopmentRating;

  @ApiPropertyOptional({ enum: DevelopmentRating, description: "Ijtimoiy ko'nikma" })
  @IsOptional()
  @IsEnum(DevelopmentRating)
  socialRating?: DevelopmentRating;

  @ApiPropertyOptional({ enum: DevelopmentRating, description: "Bilim/idrok" })
  @IsOptional()
  @IsEnum(DevelopmentRating)
  cognitiveRating?: DevelopmentRating;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
