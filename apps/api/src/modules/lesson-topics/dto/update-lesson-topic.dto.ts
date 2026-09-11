import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateLessonTopicDto {
  @ApiPropertyOptional({ example: "Sonlar va raqamlar" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @ApiPropertyOptional({ example: "Matematika" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ example: "2026-09-10" })
  @IsOptional()
  @IsDateString()
  date?: string;
}
