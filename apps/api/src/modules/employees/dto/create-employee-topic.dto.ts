import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateEmployeeTopicDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: "Mavzu nomini kiriting" })
  title!: string;
}
