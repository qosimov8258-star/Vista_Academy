import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";

/**
 * Xodimni tahrirlash — faqat yuborilgan maydonlar o'zgaradi. Login/parol
 * bu yerda emas (`/credentials`), surat ham alohida (`/avatar`).
 */
export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: "Yusupova" })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Familiya kamida 2 belgi" })
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: "Dilnoza" })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Ism kamida 2 belgi" })
  @MaxLength(60)
  firstName?: string;

  /** Bo'sh satr — telefonni olib tashlash. */
  @ApiPropertyOptional({ example: "+998901234567" })
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @Matches(/\d[\d\s()+-]{7,}/, { message: "Telefon raqami noto'g'ri" })
  phone?: string;

  @ApiPropertyOptional({ example: "Tarbiyachi" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  position?: string;

  @ApiPropertyOptional({ type: [String], description: "Faqat \"Fan o'qituvchisi\" lavozimi uchun" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  /** Nofaol xodim kabinetga kira olmaydi va yuz tanish terminalidan olib tashlanadi. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Kabineti bor xodimning guruhi — yangi ro'yxat eskisining o'rnini oladi. */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];
}
