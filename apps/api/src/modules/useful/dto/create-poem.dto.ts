import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { UsefulStatus } from "@prisma/client";

export class CreatePoemDto {
  @ApiProperty({ example: "Quyoshcha" })
  @IsString()
  @MaxLength(80)
  title!: string;

  @ApiPropertyOptional({ nullable: true, description: "Shoir; noma'lum bo'lsa bo'sh qoldiring" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  author?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "null — butun filial uchun (faqat admin/menejer)" })
  @IsOptional()
  @IsString()
  groupId?: string | null;

  @ApiPropertyOptional({ example: 3, default: 3, minimum: 2, maximum: 7 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(7)
  ageFrom?: number;

  @ApiPropertyOptional({ example: 6, default: 6, minimum: 2, maximum: 7 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(7)
  ageTo?: number;

  @ApiProperty({
    description: "Bandlar orasida bitta bo'sh qator qoldiring — server ularni ajratadi",
    example: "Tongda chiqdi quyoshcha,\nNur sochadi oz-ozcha.\n\nMen ham turdim ertalab,\nYuzim yuvdim chayqalab.",
  })
  @IsString()
  @MaxLength(6000)
  text!: string;

  @ApiPropertyOptional({ enum: UsefulStatus, default: UsefulStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(UsefulStatus)
  status?: UsefulStatus;
}
