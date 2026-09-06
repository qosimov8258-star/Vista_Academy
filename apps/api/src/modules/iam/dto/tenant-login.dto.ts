import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class TenantLoginDto {
  @ApiProperty({ example: "gavxar", description: "Tashkilot slug (URL'dagi /{slug})" })
  @IsString()
  @MinLength(1)
  orgSlug!: string;

  @ApiProperty({ example: "admin@quyoshcha.uz" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "ChangeMe123!" })
  @IsString()
  @MinLength(8)
  password!: string;
}
