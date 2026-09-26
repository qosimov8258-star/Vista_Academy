import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

/**
 * Yangi Face ID qurilmasini (Hikvision DS-K1T342MX turniket terminali)
 * ro'yxatga qo'shish. `branchId` ataylab bu yerda yo'q — yozish huquqiga ega
 * har bir foydalanuvchi (BRANCH_ADMIN/MANAGER) allaqachon bitta filialga
 * biriktirilgan, shuning uchun filial `requireOperationalScope(scope)` orqali
 * serverda aniqlanadi (`employees.service.ts`dagi bilan bir xil naqsh).
 */
export class CreateDeviceDto {
  @ApiProperty({ example: "Asosiy kirish turniketi" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: "DS-K1T342MX", description: "Berilmasa DS-K1T342MX qo'yiladi" })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
