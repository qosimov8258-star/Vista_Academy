import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateSubjectDto {
  @ApiProperty({ example: "Xoreografiya" })
  @IsString()
  @MinLength(2)
  name!: string;
}
