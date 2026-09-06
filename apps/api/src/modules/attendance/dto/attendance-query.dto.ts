import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class AttendanceQueryDto {
  @ApiPropertyOptional({ description: "Filial darajasidagi foydalanuvchilar uchun shart emas (o'z filiali ishlatiladi)" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: "2026-09-06", description: "Bo'sh qoldirilsa bugungi sana" })
  @IsOptional()
  @IsDateString()
  date?: string;
}
