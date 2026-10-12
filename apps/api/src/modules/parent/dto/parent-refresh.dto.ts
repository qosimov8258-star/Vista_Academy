import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ParentRefreshDto {
  @ApiPropertyOptional({
    description:
      "Tab-bo'yicha mustaqil sessiya uchun refresh token (sessionStorage'dan). Berilmasa, cookie'dagi qiymat ishlatiladi.",
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
