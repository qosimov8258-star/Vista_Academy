import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { LeadStage } from "@prisma/client";

export class UpdateLeadStageDto {
  @ApiProperty({ enum: LeadStage })
  @IsEnum(LeadStage)
  stage!: LeadStage;

  @ApiPropertyOptional({ description: "stage=LOST bo'lganda majburiy" })
  @IsOptional()
  @IsString()
  lostReason?: string;
}
