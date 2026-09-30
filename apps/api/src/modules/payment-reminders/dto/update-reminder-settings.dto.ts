import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/** "09:00" — soat:daqiqa (24 soatlik) ko'rinishida. */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class UpdateReminderSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 60, description: "Muddatdan necha kun oldin eslatma boshlansin" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  daysBeforeDue?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 60, description: "Muddatdan necha kun keyin ham eslatma davom etsin" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  daysAfterDue?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ["09:00", "18:00"],
    description: "Kuniga necha marta va qachon yuborilishi — har biri HH:mm ko'rinishida, 1 dan 6 tagacha",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @Matches(TIME_PATTERN, { each: true, message: "Har bir vaqt HH:mm ko'rinishida bo'lishi kerak" })
  sendTimes?: string[];

  @ApiPropertyOptional({
    description: "{childName}, {amount}, {dueDate}, {daysLeft} placeholderlari qo'llab-quvvatlanadi",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  messageTemplate?: string;
}
