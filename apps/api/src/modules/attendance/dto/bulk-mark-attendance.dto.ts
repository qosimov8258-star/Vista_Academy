import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { AttendanceStatus } from "@prisma/client";

export class BulkAttendanceItemDto {
  @ApiProperty()
  @IsString()
  childId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/**
 * Bir kunning davomatini bitta so'rovda saqlash: sahifa faqat o'zgargan
 * (yoki hali belgilanmagan) bolalarni yuboradi.
 */
export class BulkMarkAttendanceDto {
  @ApiProperty({ example: "2026-10-13" })
  @IsDateString()
  date!: string;

  @ApiProperty({ type: [BulkAttendanceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceItemDto)
  items!: BulkAttendanceItemDto[];
}
