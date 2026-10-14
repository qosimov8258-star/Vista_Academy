import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DiscountScope, DiscountType } from "@prisma/client";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

class DiscountFields {
  @ApiProperty({ enum: DiscountType, description: "PERCENTAGE — foiz, FIXED_AMOUNT — ayiriladigan summa, FINAL_AMOUNT — yakuniy oylik narx" })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({ enum: DiscountScope, description: "ONE_MONTH — faqat `period` oyi, PERMANENT — joriy oydan boshlab" })
  @IsEnum(DiscountScope)
  scope!: DiscountScope;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ example: "2026-10", description: "Bir oylik chegirma uchun majburiy (YYYY-MM)" })
  @IsOptional()
  @Matches(PERIOD, { message: "Oy noto'g'ri (YYYY-MM)" })
  period?: string;

  @ApiPropertyOptional({ example: "Aka-uka / opa-singil" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateDiscountDto extends DiscountFields {
  @ApiProperty()
  @IsString()
  childId!: string;
}

export class BulkCreateDiscountDto extends DiscountFields {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  childIds!: string[];
}

export class UpdateDiscountDto {
  @ApiPropertyOptional({ enum: DiscountType })
  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @ApiPropertyOptional({ enum: DiscountScope })
  @IsOptional()
  @IsEnum(DiscountScope)
  scope?: DiscountScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PERIOD, { message: "Oy noto'g'ri (YYYY-MM)" })
  period?: string;

  @ApiPropertyOptional({ description: "Bo'sh satr — sababni olib tashlaydi" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DiscountQueryDto {
  @ApiPropertyOptional({ example: "2026-10" })
  @IsOptional()
  @Matches(PERIOD, { message: "Oy noto'g'ri (YYYY-MM)" })
  period?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}
