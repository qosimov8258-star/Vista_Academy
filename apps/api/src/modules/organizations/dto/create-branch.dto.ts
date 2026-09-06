import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateBranchDto {
  @ApiProperty({ example: "Yunusobod filiali" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: "Yunusobod tumani, 12-uy" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "Aziz Rahimov", description: "Berilsa, shu filialga darhol Filial menejeri yaratiladi" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  managerFullName?: string;

  @ApiPropertyOptional({ example: "menejer@tarmoq.uz" })
  @IsOptional()
  @IsEmail()
  managerEmail?: string;

  @ApiPropertyOptional({ example: "ChangeMe123!" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  managerPassword?: string;
}
