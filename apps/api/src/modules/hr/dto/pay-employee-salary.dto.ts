import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNumber, IsOptional, Matches, Min } from "class-validator";

export class PayEmployeeSalaryDto {
  @ApiProperty({ example: "2026-09" })
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @ApiProperty({ description: "Moliyachi qo'lda kiritgan, haqiqatda beriladigan summa" })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ required: false, enum: ["CASH", "CLICK", "PAYME", "MOBILE_APP", "CARD", "OTHER"] })
  @IsOptional()
  @IsIn(["CASH", "CLICK", "PAYME", "MOBILE_APP", "CARD", "OTHER"])
  method?: "CASH" | "CLICK" | "PAYME" | "MOBILE_APP" | "CARD" | "OTHER";
}
