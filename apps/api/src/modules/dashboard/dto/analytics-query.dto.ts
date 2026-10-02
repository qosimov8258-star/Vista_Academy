import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";

export const ANALYTICS_PERIODS = ["day", "week", "month", "year"] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ANALYTICS_PERIODS, default: "month" })
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS)
  period?: AnalyticsPeriod;
}
