import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateTopicQuestionDto {
  @ApiPropertyOptional({ example: "5 + 3 nechiga teng?" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  question?: string;

  @ApiPropertyOptional({ type: [String], example: ["6", "7", "8", "9"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ example: "8" })
  @IsOptional()
  @IsString()
  answer?: string;
}
