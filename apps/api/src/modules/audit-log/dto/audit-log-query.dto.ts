import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Audit ro'yxati uchun umumiy filtrlar — ro'yxat ham, xodimlar ro'yxati ham shularni oladi */
export class AuditLogFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: "Faqat shu foydalanuvchi bajargan amallar" })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ description: "Vergul bilan: Child,Group — bo'lim bo'yicha filtr", example: "Payment,Invoice" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  entityTypes?: string;

  @ApiPropertyOptional({ description: "Shu kundan (Toshkent vaqti bilan), shu kun ham kiradi", example: "2026-09-01" })
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @ApiPropertyOptional({ description: "Shu kungacha (Toshkent vaqti bilan), shu kun ham kiradi", example: "2026-09-30" })
  @IsOptional()
  @Matches(DATE)
  to?: string;

  @ApiPropertyOptional({ description: "Amal matni yoki bajargan kishi ismi bo'yicha qidiruv" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class AuditLogQueryDto extends AuditLogFilterDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 30;
}
