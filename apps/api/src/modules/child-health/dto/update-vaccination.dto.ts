import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { VaccinationStatus } from "@prisma/client";

export class UpdateVaccinationDto {
  @ApiProperty({ enum: VaccinationStatus })
  @IsEnum(VaccinationStatus)
  status!: VaccinationStatus;

  @ApiPropertyOptional({ example: "2026-10-01" })
  @IsOptional()
  @IsDateString()
  doneDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
