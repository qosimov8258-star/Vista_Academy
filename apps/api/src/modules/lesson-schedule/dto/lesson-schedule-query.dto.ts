import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class LessonScheduleQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ description: "Filial darajasidagi foydalanuvchilar uchun shart emas (o'z filiali ishlatiladi)" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: "Xona jadvali" })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ description: "O'qituvchi jadvali" })
  @IsOptional()
  @IsString()
  employeeId?: string;
}
