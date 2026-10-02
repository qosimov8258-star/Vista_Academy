import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateTeacherDto {
  @ApiProperty({ example: "Dilnoza Qosimova" })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: "Bosh tarbiyachi" })
  @IsString()
  @MinLength(2)
  role!: string;

  @ApiPropertyOptional({ example: "Har bir bola menga o'z farzandimdek aziz." })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: "10 yillik tajribaga ega, ingliz tili bo'yicha xalqaro sertifikatlangan (IELTS 8.0)." })
  @IsOptional()
  @IsString()
  experience?: string;

  @ApiPropertyOptional({ description: "`role`ning rus tarjimasi", example: "Главный воспитатель" })
  @IsOptional()
  @IsString()
  roleRu?: string;

  @ApiPropertyOptional({ description: "`role`ning ingliz tarjimasi", example: "Head caregiver" })
  @IsOptional()
  @IsString()
  roleEn?: string;

  @ApiPropertyOptional({ description: "`bio`ning rus tarjimasi" })
  @IsOptional()
  @IsString()
  bioRu?: string;

  @ApiPropertyOptional({ description: "`bio`ning ingliz tarjimasi" })
  @IsOptional()
  @IsString()
  bioEn?: string;

  @ApiPropertyOptional({ description: "`experience`ning rus tarjimasi" })
  @IsOptional()
  @IsString()
  experienceRu?: string;

  @ApiPropertyOptional({ description: "`experience`ning ingliz tarjimasi" })
  @IsOptional()
  @IsString()
  experienceEn?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}
