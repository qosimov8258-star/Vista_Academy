import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateBranchDto {
  @ApiPropertyOptional({ example: "Yunusobod filiali" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: "Yunusobod tumani, 12-uy" })
  @IsOptional()
  @IsString()
  address?: string;
}
