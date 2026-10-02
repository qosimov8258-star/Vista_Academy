import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { LandingMealType, Weekday } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateMealDto {
  @ApiProperty({ example: "Sabzavotli osh" })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional({ example: "Guruch, sabzi, no'xat va mol go'shti bilan" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "`title`ning rus tarjimasi" })
  @IsOptional()
  @IsString()
  titleRu?: string;

  @ApiPropertyOptional({ description: "`title`ning ingliz tarjimasi" })
  @IsOptional()
  @IsString()
  titleEn?: string;

  @ApiPropertyOptional({ description: "`description`ning rus tarjimasi" })
  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @ApiPropertyOptional({ description: "`description`ning ingliz tarjimasi" })
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional({ enum: LandingMealType, default: LandingMealType.OTHER })
  @IsOptional()
  @IsEnum(LandingMealType)
  mealType?: LandingMealType;

  @ApiPropertyOptional({ enum: Weekday, description: "Haftalik menyuda shu taom chiqadigan kun" })
  @IsOptional()
  @IsEnum(Weekday)
  weekday?: Weekday;

  @ApiPropertyOptional({ example: "08:30", description: "Taom beriladigan vaqt (SS:DD)" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Vaqt SS:DD formatida bo'lishi kerak (masalan, 08:30)" })
  time?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}
