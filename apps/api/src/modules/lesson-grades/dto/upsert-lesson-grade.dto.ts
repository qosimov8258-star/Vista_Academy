import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertLessonGradeDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty()
  @IsString()
  groupId!: string;

  @ApiProperty({ example: "2026-09-10" })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 8, minimum: 1, maximum: 10, description: "1-10 baho: ishtirok/bajargan amaliy topshiriqlar soniga qarab" })
  @IsInt()
  @Min(1)
  @Max(10)
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
