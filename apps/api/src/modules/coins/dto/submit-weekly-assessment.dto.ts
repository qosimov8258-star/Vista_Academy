import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, ValidateNested } from "class-validator";

export class WeeklyAssessmentAnswerDto {
  @ApiProperty()
  @IsString()
  questionId!: string;

  @ApiProperty()
  @IsBoolean()
  correct!: boolean;
}

export class SubmitWeeklyAssessmentDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiPropertyOptional({
    example: "2026-09-14",
    description: "Ixtiyoriy — berilmasa bugungi haftaning dushanbasi ishlatiladi",
  })
  @IsOptional()
  @IsDateString()
  weekStart?: string;

  @ApiProperty()
  @IsBoolean()
  poemRecited!: boolean;

  @ApiProperty({ type: [WeeklyAssessmentAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyAssessmentAnswerDto)
  answers!: WeeklyAssessmentAnswerDto[];
}
