import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";

/**
 * Xodimga tizimga kirish huquqi. Hamma xodimga ham kerak emas — oshpaz yoki
 * farrosh kabinetsiz ishlaydi, shuning uchun bu blok ixtiyoriy.
 */
export class EmployeeAccountDto {
  @ApiProperty({ example: "tarbiyachi@tarmoq.uz" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "ChangeMe123!" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    type: [String],
    description: "Tarbiyachiga biriktiriladigan guruhlar — u faqat shularni ko'radi",
  })
  @IsArray()
  @ArrayNotEmpty({ message: "Kamida bitta guruh tanlang" })
  @IsString({ each: true })
  groupIds!: string[];
}

export class CreateEmployeeDto {
  @ApiProperty({ example: "Yusupova Dilnoza" })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: "Tarbiyachi" })
  @IsString()
  @MinLength(2)
  position!: string;

  @ApiPropertyOptional({ type: EmployeeAccountDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmployeeAccountDto)
  account?: EmployeeAccountDto;
}
