import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CallDoneDto {
  @ApiProperty({ enum: ["DEBT", "ABSENT", "LEAD"] })
  @IsIn(["DEBT", "ABSENT", "LEAD"])
  kind!: "DEBT" | "ABSENT" | "LEAD";

  @ApiProperty()
  @IsString()
  subjectId!: string;

  @ApiProperty({ example: "2026-09-21" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: "Ertaga to'laydi" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class MarkPickupDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ example: "2026-09-21" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: "Ro'yxatdagi ota-onalardan biri" })
  @IsOptional()
  @IsString()
  guardianId?: string;

  @ApiPropertyOptional({ description: "Ro'yxatda yo'q odam olib ketsa — ismi" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  pickedByName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class BroadcastDto {
  @ApiPropertyOptional({ description: "Bo'sh — filialdagi hamma guruh" })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({ example: "Ertaga bog'cha dam olish kuni." })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  message!: string;
}
