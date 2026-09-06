import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateMedicationLogDto {
  @ApiProperty({ example: "Paratsetamol" })
  @IsString()
  @MinLength(2)
  medicationName!: string;

  @ApiProperty({ example: "5 ml" })
  @IsString()
  dose!: string;

  @ApiProperty({ example: "2026-09-06T10:30:00.000Z" })
  @IsDateString()
  givenAt!: string;

  @ApiProperty({ description: "Ota-ona rasman ruxsat berganmi" })
  @IsBoolean()
  parentAuthorized!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
