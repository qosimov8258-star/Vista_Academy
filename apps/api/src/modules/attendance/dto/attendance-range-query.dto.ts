import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class AttendanceRangeQueryDto {
  @ApiPropertyOptional({ description: "Filial darajasidagi foydalanuvchilar uchun shart emas (o'z filiali ishlatiladi)" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: "2026-08-29" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-09-11" })
  @IsOptional()
  @IsDateString()
  to?: string;
}
