import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { LeadActivityType } from "@prisma/client";

export class CreateLeadActivityDto {
  @ApiProperty({ enum: LeadActivityType })
  @IsEnum(LeadActivityType)
  type!: LeadActivityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
