import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateParentQuestionDto {
  @ApiProperty({ example: "Bugun bog'chada nima haqida gaplashdik?" })
  @IsString()
  @MinLength(2)
  question!: string;
}
