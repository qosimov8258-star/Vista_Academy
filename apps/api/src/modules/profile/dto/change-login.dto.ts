import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class ChangeLoginDto {
  @ApiProperty({ example: "dilnoza.yusupova" })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/, {
    message: "Login lotin harf, raqam, . _ - dan iborat bo'lishi va kamida 3 belgi bo'lishi kerak",
  })
  login!: string;
}
