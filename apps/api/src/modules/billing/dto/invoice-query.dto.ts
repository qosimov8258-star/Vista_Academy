import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { InvoiceStatus } from "@prisma/client";

export class InvoiceQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  childId?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: "Bola ismi bo'yicha qidiruv" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "2026-09", description: "Hisob-faktura davri (period) bo'yicha aniq mos kelish" })
  @IsOptional()
  @IsString()
  period?: string;

  // Hech kim `status: OVERDUE` deb yozmaydi (pastga qarang) — shuning uchun
  // "muddati o'tganlar" alohida bayroq bilan so'raladi, `status` bilan emas.
  @ApiPropertyOptional({ description: "Faqat muddati o'tgan (PENDING/PARTIALLY_PAID + dueDate < bugun) fakturalar" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  overdueOnly?: boolean;
}
