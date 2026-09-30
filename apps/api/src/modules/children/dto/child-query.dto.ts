import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ChildStatus } from "@prisma/client";
import { FINANCE_CHILD_STATUSES, FinanceChildStatus } from "../../billing/dto/finance-query.dto";

export class ChildQueryDto {
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
  groupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ChildStatus })
  @IsOptional()
  @IsEnum(ChildStatus)
  status?: ChildStatus;

  @ApiPropertyOptional({
    enum: FINANCE_CHILD_STATUSES,
    description: "To'lov holati — joriy oy hisob-fakturasiga qarab hisoblanadi (moliyachi paneli uchun)",
  })
  @IsOptional()
  @IsIn(FINANCE_CHILD_STATUSES)
  paymentStatus?: FinanceChildStatus;
}
