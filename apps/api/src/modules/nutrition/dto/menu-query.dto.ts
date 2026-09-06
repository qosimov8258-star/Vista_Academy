import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class MenuQueryDto {
  @ApiPropertyOptional({ description: "Filial darajasidagi foydalanuvchilar uchun shart emas (o'z filiali ishlatiladi)" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ example: "2026-09-08" })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: "2026-09-14" })
  @IsDateString()
  to!: string;
}
