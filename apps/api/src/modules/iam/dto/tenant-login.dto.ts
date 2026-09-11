import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class TenantLoginDto {
  @ApiProperty({ example: "gavxar", description: "Tashkilot slug (URL'dagi /{slug})" })
  @IsString()
  @MinLength(1)
  orgSlug!: string;

  @ApiProperty({ example: "admin_quyoshcha", description: "Login (eski hisoblarda avvalgi email qiymati)" })
  @IsString()
  @MinLength(1)
  login!: string;

  @ApiProperty({ example: "ChangeMe123!" })
  @IsString()
  @MinLength(8)
  password!: string;
}
