import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class LessonGradeQueryDto {
  @ApiProperty()
  @IsString()
  groupId!: string;

  @ApiPropertyOptional({ example: "2026-09-10", description: "Bo'sh qoldirilsa bugungi sana (Asia/Tashkent)" })
  @IsOptional()
  @IsDateString()
  date?: string;
}
