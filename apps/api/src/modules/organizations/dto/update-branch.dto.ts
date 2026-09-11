import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString, Matches, Min, MinLength, ValidateIf } from "class-validator";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: "Yunusobod filiali" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  // `null` — maydonni tozalash. `undefined` (butunlay yuborilmasa) —
  // o'zgartirmaslik. Ikkalasi ham `@IsOptional()` bilan validatsiyadan o'tadi.
  @ApiPropertyOptional({ example: "Yunusobod tumani, 12-uy", nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ example: "08:00", description: "HH:MM shaklida", nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME_PATTERN, { message: "Vaqt HH:MM shaklida bo'lishi kerak" })
  openTime?: string | null;

  @ApiPropertyOptional({ example: "19:00", description: "HH:MM shaklida", nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(TIME_PATTERN, { message: "Vaqt HH:MM shaklida bo'lishi kerak" })
  closeTime?: string | null;

  // Oddiy `@Type(() => Number)` ishlatilmaydi — u `null`ni `Number(null) === 0`
  // qilib aylantirib, "tozalash"ni "0 so'mga o'rnatish"ga aylantirib qo'yardi.
  @ApiPropertyOptional({ example: 500000, nullable: true })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined || value === "" ? value : Number(value)))
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  defaultTuitionAmount?: number | null;
}
