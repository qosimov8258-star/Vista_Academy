import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateDishDto {
  @ApiProperty({ example: "Sutli bo'tqa" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 250 })
  @IsOptional()
  @IsInt()
  @Min(0)
  calories?: number;

  @ApiPropertyOptional({ example: "sut, yong'oq" })
  @IsOptional()
  @IsString()
  allergens?: string;
}
