import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateProductDto {
  @ApiProperty({ example: "Bolalar futbolkasi" })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: "Ko'k" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  color?: string;

  @ApiPropertyOptional({ example: "Rangli qalamlar to'plami, 24 dona" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 500, description: "Necha coinga sotiladi" })
  @IsInt()
  @Min(0)
  priceCoins!: number;

  @ApiPropertyOptional({ example: 10, description: "Ko'rsatilmasa 0 dan boshlanadi" })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;
}
