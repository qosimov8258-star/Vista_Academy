import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class SubmitAbsenceReasonDto {
  @ApiProperty({ example: "Shifokorga bordik" })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
