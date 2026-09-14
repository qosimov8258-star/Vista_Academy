import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Length } from "class-validator";
import { UsefulStatus } from "@prisma/client";

export class CreateProverbDto {
  @ApiProperty({ example: "Mehnatning tagi — rohat." })
  @IsString()
  @Length(3, 160)
  text!: string;

  @ApiProperty({ example: "Kim harakat qilsa, keyin quvonchini ko'radi.", description: "Bolaga tushuntirish uchun sodda izoh" })
  @IsString()
  @Length(3, 400)
  meaning!: string;

  @ApiPropertyOptional({ nullable: true, description: "null — butun filial uchun (faqat admin/menejer)" })
  @IsOptional()
  @IsString()
  groupId?: string | null;

  @ApiPropertyOptional({ enum: UsefulStatus, default: UsefulStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(UsefulStatus)
  status?: UsefulStatus;
}
