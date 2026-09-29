import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

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

  @ApiPropertyOptional({ example: 80, description: "ISAPI (HTTP) porti" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ example: "admin", description: "Qurilma administratori logini" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @ApiPropertyOptional({ description: "Qurilma paroli — shifrlab saqlanadi, hech qachon qaytarilmaydi. Bo'sh qator — parolni o'chirish" })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
