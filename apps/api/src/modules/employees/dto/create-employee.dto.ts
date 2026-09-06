import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateEmployeeDto {
  @ApiProperty({ example: "Yusupova Dilnoza" })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: "Tarbiyachi" })
  @IsString()
  @MinLength(2)
  position!: string;
}
