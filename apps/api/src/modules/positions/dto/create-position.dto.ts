import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreatePositionDto {
  @ApiProperty({ example: "Hovli farroshi" })
  @IsString()
  @MinLength(2)
  name!: string;
}
