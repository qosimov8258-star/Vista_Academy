import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class UpdateLeadDetailsDto {
  @ApiPropertyOptional({ example: "2026-09-15", description: "Keyingi bog'lanish sanasi" })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional({ example: "2026-09-18" })
  @IsOptional()
  @IsDateString()
  trialDate?: string;

  @ApiPropertyOptional({ example: "2026-09-20" })
  @IsOptional()
  @IsDateString()
  contractDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractNote?: string;
}
