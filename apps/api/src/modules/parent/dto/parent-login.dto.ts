import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ParentLoginDto {
  @ApiProperty({ example: "usmon" })
  @IsString()
  orgSlug!: string;

  @ApiProperty({ example: "+998901234567", description: "Login — bolaga biriktirilgan telefon raqami" })
  @IsString()
  @MinLength(7)
  phone!: string;

  @ApiProperty({ example: "olma-7421" })
  @IsString()
  @MinLength(6)
  password!: string;
}
