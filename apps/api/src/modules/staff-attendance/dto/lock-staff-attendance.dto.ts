import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class LockStaffAttendanceDto {
  @ApiPropertyOptional({ description: "Filial darajasidagi foydalanuvchilar uchun shart emas (o'z filiali ishlatiladi)" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ example: "2026-09-06" })
  @IsDateString()
  date!: string;
}
