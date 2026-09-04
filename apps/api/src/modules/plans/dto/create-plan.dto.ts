import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreatePlanDto {
  @ApiProperty({ example: "Standart" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "standard" })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 1500000 })
  @IsNumber()
  @Min(0)
  priceMonthly!: number;

  @ApiPropertyOptional({ example: "UZS", default: "UZS" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  maxBranches!: number;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(1)
  maxChildren!: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  maxEmployees!: number;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(1)
  maxStorageGb!: number;

  @ApiPropertyOptional({ example: { sms: true, telegram: true, onlinePayment: false } })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;
}
