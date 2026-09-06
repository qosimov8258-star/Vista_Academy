import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, Min } from "class-validator";
import { SalaryRuleType } from "@prisma/client";

export class UpsertSalarySchemeDto {
  @ApiProperty({ enum: SalaryRuleType })
  @IsEnum(SalaryRuleType)
  ruleType!: SalaryRuleType;

  @ApiPropertyOptional({ example: 2500000, description: "ruleType=FIXED bo'lganda ishlatiladi" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @ApiPropertyOptional({ example: 15000, description: "ruleType=PER_HOUR yoki PER_CHILD bo'lganda birlik narxi" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;
}
