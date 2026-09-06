import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { EatingQuality, MoodStatus } from "@prisma/client";

export class UpsertDailyReportDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ example: "2026-09-06" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ enum: EatingQuality })
  @IsOptional()
  @IsEnum(EatingQuality)
  eatingQuality?: EatingQuality;

  @ApiPropertyOptional({ example: 90, description: "Uyqu davomiyligi (daqiqa)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  sleepMinutes?: number;

  @ApiPropertyOptional({ enum: MoodStatus })
  @IsOptional()
  @IsEnum(MoodStatus)
  mood?: MoodStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toiletNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activityNotes?: string;
}
