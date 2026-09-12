import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { UsefulStatus } from "@prisma/client";

const TALE_COVERS = ["tun", "sholgom"] as const;

export class UpdateTaleDto {
  @ApiPropertyOptional({ example: "Sholg'om" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ example: "Rus xalq ertagi" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  origin?: string;

  @ApiPropertyOptional({ description: "Xatboshilar orasida bitta bo'sh qator qoldiring — server ularni ajratadi" })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  text?: string;

  @ApiPropertyOptional({ example: "Birga, ahil bo'lsak — har qanday ishni uddalaymiz." })
  @IsOptional()
  @IsString()
  @Length(3, 300)
  moral?: string;

  @ApiPropertyOptional({ type: [String], description: "0–8 ta, har biri 3–150 belgi" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @Length(3, 150, { each: true })
  questions?: string[];

  @ApiPropertyOptional({ nullable: true, description: "null — server so'z soniga qarab hisoblaydi" })
  @IsOptional()
  @IsInt()
  @Min(1)
  minutes?: number | null;

  @ApiPropertyOptional({ enum: TALE_COVERS })
  @IsOptional()
  @IsIn(TALE_COVERS)
  cover?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  groupId?: string | null;

  @ApiPropertyOptional({ minimum: 2, maximum: 7 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(7)
  ageFrom?: number;

  @ApiPropertyOptional({ minimum: 2, maximum: 7 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(7)
  ageTo?: number;

  @ApiPropertyOptional({ enum: UsefulStatus })
  @IsOptional()
  @IsEnum(UsefulStatus)
  status?: UsefulStatus;
}
