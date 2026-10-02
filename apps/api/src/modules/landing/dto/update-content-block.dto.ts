import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateContentBlockDto {
  @ApiProperty({ example: "Doimiy tarbiyachi" })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: "Har bir guruhda o'quv yili davomida bitta doimiy tarbiyachi ishlaydi..." })
  @IsString()
  @MinLength(2)
  body!: string;

  @ApiPropertyOptional({ description: "`title`ning rus tarjimasi" })
  @IsOptional()
  @IsString()
  titleRu?: string;

  @ApiPropertyOptional({ description: "`title`ning ingliz tarjimasi" })
  @IsOptional()
  @IsString()
  titleEn?: string;

  @ApiPropertyOptional({ description: "`body`ning rus tarjimasi" })
  @IsOptional()
  @IsString()
  bodyRu?: string;

  @ApiPropertyOptional({ description: "`body`ning ingliz tarjimasi" })
  @IsOptional()
  @IsString()
  bodyEn?: string;
}
