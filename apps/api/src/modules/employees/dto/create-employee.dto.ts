import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsOptional, IsString, Matches, MinLength, ValidateNested } from "class-validator";

/**
 * Xodimga tizimga kirish huquqi. Hamma xodimga ham kerak emas — oshpaz yoki
 * farrosh kabinetsiz ishlaydi, shuning uchun bu blok ixtiyoriy. Login va
 * parolni admin o'zi kiritishi mumkin; bo'sh qoldirilsa backend avtomatik
 * generatsiya qiladi (`generateEmployeeLogin`/`generateEmployeePassword`) va
 * bir martalik javobda qaytaradi.
 */
export class EmployeeAccountDto {
  @ApiProperty({
    type: [String],
    description: "Tarbiyachiga biriktiriladigan guruhlar — u faqat shularni ko'radi",
  })
  @IsArray()
  @ArrayNotEmpty({ message: "Kamida bitta guruh tanlang" })
  @IsString({ each: true })
  groupIds!: string[];

  @ApiPropertyOptional({
    example: "dilnoza.yusupova",
    description: "Berilmasa avtomatik generatsiya qilinadi (ism.familiya)",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/, {
    message: "Login lotin harf, raqam, . _ - dan iborat bo'lishi va kamida 3 belgi bo'lishi kerak",
  })
  login?: string;

  @ApiPropertyOptional({
    example: "Ab12345!",
    description: "Berilmasa avtomatik generatsiya qilinadi",
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" })
  @Matches(/[A-Z]/, { message: "Parolda kamida bitta bosh harf bo'lishi kerak" })
  @Matches(/[^A-Za-z0-9]/, { message: "Parolda kamida bitta maxsus belgi bo'lishi kerak" })
  password?: string;
}

export class CreateEmployeeDto {
  @ApiProperty({ example: "Yusupova" })
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty({ example: "Dilnoza" })
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiPropertyOptional({ example: "+998901234567" })
  @IsOptional()
  @IsString()
  @Matches(/\d[\d\s()+-]{7,}/, { message: "Telefon raqami noto'g'ri" })
  phone?: string;

  @ApiProperty({ example: "Tarbiyachi" })
  @IsString()
  @MinLength(2)
  position!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ["Ingliz tili"],
    description: "Faqat \"Fan o'qituvchisi\" lavozimi uchun — qaysi fanlarni o'qitishini belgilaydi",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjects?: string[];

  @ApiPropertyOptional({ type: EmployeeAccountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeAccountDto)
  account?: EmployeeAccountDto;
}
