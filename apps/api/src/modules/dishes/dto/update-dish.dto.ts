import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min, MinLength, ValidateIf } from "class-validator";

export class UpdateDishDto {
  @ApiPropertyOptional({ example: "Sutli bo'tqa" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 250, nullable: true, description: "null yuborilsa maydon tozalanadi" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  calories?: number | null;

  @ApiPropertyOptional({ example: "sut, yong'oq", nullable: true, description: "null yuborilsa maydon tozalanadi" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  allergens?: string | null;
}
