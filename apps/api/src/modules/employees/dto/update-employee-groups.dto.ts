import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

export class UpdateEmployeeGroupsDto {
  @ApiProperty({ type: [String], description: "Yangi ro'yxat — eskisining o'rnini oladi" })
  @IsArray()
  @IsString({ each: true })
  groupIds!: string[];
}
