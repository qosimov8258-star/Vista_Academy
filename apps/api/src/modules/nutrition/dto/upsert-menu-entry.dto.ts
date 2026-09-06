import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class UpsertMenuEntryDto {
  @ApiProperty({ example: "2026-09-08" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: "Sutli botqa, non, choy" })
  @IsOptional()
  @IsString()
  breakfast?: string;

  @ApiPropertyOptional({ example: "Sho'rva, osh, salat" })
  @IsOptional()
  @IsString()
  lunch?: string;

  @ApiPropertyOptional({ example: "Meva, kefir" })
  @IsOptional()
  @IsString()
  snack?: string;
}
