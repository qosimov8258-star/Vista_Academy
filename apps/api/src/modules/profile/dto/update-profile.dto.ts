import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class UpdateProfileDto {
  @ApiProperty({ example: "Yusupova Dilnoza" })
  @IsString()
  @MinLength(2)
  fullName!: string;
}
