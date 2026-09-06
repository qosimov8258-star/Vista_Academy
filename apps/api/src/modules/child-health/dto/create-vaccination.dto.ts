import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateVaccinationDto {
  @ApiProperty({ example: "DPT (Difteriya, ko'k yo'tal, qoqshol)" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "2026-10-01" })
  @IsDateString()
  scheduledDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
