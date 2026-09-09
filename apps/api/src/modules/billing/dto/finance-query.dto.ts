import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";

/** "2026-09" — hisob-faktura davri. */
const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class FinanceSummaryQueryDto {
  @ApiPropertyOptional({ example: "2026-09", description: "Bo'sh qoldirilsa joriy oy" })
  @IsOptional()
  @Matches(PERIOD_PATTERN, { message: "Davr YYYY-MM ko'rinishida bo'lishi kerak" })
  period?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export const FINANCE_CHILD_STATUSES = ["PAID", "PARTIAL", "UNPAID"] as const;
export type FinanceChildStatus = (typeof FINANCE_CHILD_STATUSES)[number];

export class FinanceChildrenQueryDto extends FinanceSummaryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ enum: FINANCE_CHILD_STATUSES })
  @IsOptional()
  @IsIn(FINANCE_CHILD_STATUSES)
  status?: FinanceChildStatus;

  @ApiPropertyOptional({ description: "Ism yoki qisqa raqam bo'yicha qidiruv" })
  @IsOptional()
  @IsString()
  search?: string;
}
