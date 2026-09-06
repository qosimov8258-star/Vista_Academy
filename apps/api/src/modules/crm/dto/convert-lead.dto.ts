import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ConvertLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupId?: string;
}
