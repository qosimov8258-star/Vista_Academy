import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class MyLessonsQueryDto {
  @ApiPropertyOptional({ example: "2026-09-19", description: "Bo'sh qoldirilsa bugungi sana (Asia/Tashkent)" })
  @IsOptional()
  @IsDateString()
  date?: string;
}
