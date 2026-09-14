import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { UsefulStatus } from "@prisma/client";

export class UpdatePoemDto {
  @ApiPropertyOptional({ example: "Quyoshcha" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  author?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "null — butun filial uchun (faqat admin/menejer)" })
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

  @ApiPropertyOptional({ description: "Bandlar orasida bitta bo'sh qator qoldiring — server ularni ajratadi" })
  @IsOptional()
  @IsString()
  @MaxLength(6000)
  text?: string;

  @ApiPropertyOptional({ enum: UsefulStatus })
  @IsOptional()
  @IsEnum(UsefulStatus)
  status?: UsefulStatus;
}
