import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateReminderDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ example: "2026-09-19" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: "10:00" })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Vaqt SS:DD ko'rinishida bo'lsin (masalan 10:00)" })
  time?: string;

  @ApiProperty({ example: "Dori ichishi kerak" })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  text!: string;
}
