import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class UpdateRoomDto {
  @ApiPropertyOptional({ example: "1-xona" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
