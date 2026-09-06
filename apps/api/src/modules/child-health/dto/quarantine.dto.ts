import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsString, MinLength } from "class-validator";

export class SetQuarantineDto {
  @ApiProperty({ example: "2026-09-13" })
  @IsDateString()
  until!: string;

  @ApiProperty({ example: "Vetryanka (suvchechak)" })
  @IsString()
  @MinLength(2)
  reason!: string;
}
