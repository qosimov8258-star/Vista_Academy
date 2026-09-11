import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "platform_admin", description: "Login (eski hisoblarda avvalgi email qiymati)" })
  @IsString()
  @MinLength(1)
  login!: string;

  @ApiProperty({ example: "ChangeMe123!" })
  @IsString()
  @MinLength(8)
  password!: string;
}
