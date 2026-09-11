import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";

export class StaffAttendanceSummaryQueryDto {
  @ApiPropertyOptional({ description: "Filial darajasidagi foydalanuvchilar uchun shart emas (o'z filiali ishlatiladi)" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: "2026-09", description: "Bo'sh qoldirilsa joriy oy" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: "Davr YYYY-MM shaklida bo'lishi kerak" })
  period?: string;
}
