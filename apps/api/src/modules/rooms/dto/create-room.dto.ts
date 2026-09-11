import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateRoomDto {
  @ApiProperty({ example: "1-xona" })
  @IsString()
  @MinLength(1)
  name!: string;
}
