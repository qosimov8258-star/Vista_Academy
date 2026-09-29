import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

/** Bitta ISAPI AcsEvent voqeasi (agent `InfoList` elementidan tuzadi). */
export class AgentEventDto {
  @ApiProperty({ description: "Qurilmadagi voqea raqami (serialNo)" })
  @IsInt()
  @Min(0)
  serialNo!: number;

  @ApiPropertyOptional({ description: "employeeNoString — xodim raqami" })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  employeeNo?: string;

  @ApiProperty({ example: "2026-09-29T08:02:11+05:00", description: "Qurilma vaqti, zona siljishi bilan" })
  @IsISO8601({ strict: true })
  eventTime!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  major!: number;

  @ApiProperty({ example: 75 })
  @IsInt()
  minor!: number;

  @ApiPropertyOptional({ example: "face" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  verifyMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  pictureUrl?: string;

  @ApiProperty({ description: "Qurilmadan kelgan asl voqea (tekshirish uchun)" })
  @IsObject()
  raw!: Record<string, unknown>;
}

export class AgentEventsDto {
  @ApiProperty({ type: [AgentEventDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AgentEventDto)
  events!: AgentEventDto[];
}
