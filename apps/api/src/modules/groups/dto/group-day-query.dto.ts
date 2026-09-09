import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class GroupDayQueryDto {
  @ApiPropertyOptional({ example: "2026-09-09", description: "Bo'sh qoldirilsa bugungi sana (Asia/Tashkent)" })
  @IsOptional()
  @IsDateString()
  date?: string;
}
