import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Matches, Min } from "class-validator";

export class PayEmployeeSalaryDto {
  @ApiProperty({ example: "2026-09" })
  @Matches(/^\d{4}-\d{2}$/)
  period!: string;

  @ApiProperty({ description: "Moliyachi qo'lda kiritgan, haqiqatda beriladigan summa" })
  @IsNumber()
  @Min(1)
  amount!: number;
}
