import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class GuardianQueryDto {
  @ApiPropertyOptional({ description: "Ism yoki telefon bo'yicha qidiruv" })
  @IsOptional()
  @IsString()
  search?: string;
}
