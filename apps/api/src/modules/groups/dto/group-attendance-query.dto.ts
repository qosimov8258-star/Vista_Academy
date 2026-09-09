import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";

export class GroupAttendanceQueryDto {
  @ApiPropertyOptional({ example: "2026-09-01", description: "Bo'sh qoldirilsa oxirgi 14 kun olinadi" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-09-14", description: "Bo'sh qoldirilsa bugungi sana" })
  @IsOptional()
  @IsDateString()
  to?: string;
}
