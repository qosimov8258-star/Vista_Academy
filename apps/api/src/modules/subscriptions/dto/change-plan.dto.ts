import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ChangePlanDto {
  @ApiProperty()
  @IsString()
  planId!: string;
}
