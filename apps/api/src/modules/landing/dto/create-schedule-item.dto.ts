import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { LandingScheduleType } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateScheduleItemDto {
  @ApiProperty({ example: "08:00" })
  @IsString()
  @MinLength(1)
  time!: string;

  @ApiProperty({ example: "Qabul va nonushta" })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional({ description: "`title`ning rus tarjimasi" })
  @IsOptional()
  @IsString()
  titleRu?: string;

  @ApiPropertyOptional({ description: "`title`ning ingliz tarjimasi" })
  @IsOptional()
  @IsString()
  titleEn?: string;

  @ApiPropertyOptional({ enum: LandingScheduleType, default: LandingScheduleType.OTHER })
  @IsOptional()
  @IsEnum(LandingScheduleType)
  type?: LandingScheduleType;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}
