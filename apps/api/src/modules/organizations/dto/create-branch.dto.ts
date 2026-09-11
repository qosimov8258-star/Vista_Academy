import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MinLength } from "class-validator";
import { LOGIN_PATTERN, LOGIN_PATTERN_MESSAGE } from "../../../common/validators/login";

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

  @ApiPropertyOptional({ example: "filial_admin" })
  @IsOptional()
  @IsString()
  @Matches(LOGIN_PATTERN, { message: LOGIN_PATTERN_MESSAGE })
  managerLogin?: string;

  @ApiPropertyOptional({ example: "ChangeMe123!" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  managerPassword?: string;
}
