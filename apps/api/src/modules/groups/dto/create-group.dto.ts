import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateIf } from "class-validator";

export class CreateGroupDto {
  @ApiProperty({ example: "Kapalakchalar (3-4 yosh)" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;

  /** Oylik to'lov narxi (so'm). `null` — guruh narxi olib tashlanadi, filial narxi ishlatiladi */
  @ApiPropertyOptional({ example: 1000000, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  monthlyFee?: number | null;
}
