import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsString } from "class-validator";

export class RequestContactDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ example: "2026-09-06" })
  @IsDateString()
  date!: string;
}
