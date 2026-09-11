import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateLessonTopicDto {
  @ApiProperty()
  @IsString()
  groupId!: string;

  @ApiProperty({ example: "Sonlar va raqamlar" })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional({ example: "Matematika" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: "2026-09-10" })
  @IsDateString()
  date!: string;
}
