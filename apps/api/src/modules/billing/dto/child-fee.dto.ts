import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, ValidateIf } from "class-validator";
import { MoneyAmount } from "./money";

/** Bolaning oylik narxi. `null` — o'z narxi olib tashlanadi, guruh (filial) narxi olinadi. */
export class SetChildFeeDto {
  @ApiProperty({ example: 2600000, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @MoneyAmount()
  amount!: number | null;
}
