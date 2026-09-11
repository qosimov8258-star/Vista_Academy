import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class AssignLeadDto {
  @ApiProperty()
  @IsString()
  assignedToUserId!: string;
}
