import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateIf } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
import { GroupStatus } from "@prisma/client";

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: "Kapalakchalar (3-4 yosh)" })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;

  @ApiPropertyOptional({ enum: GroupStatus })
  @IsOptional()
  @IsEnum(GroupStatus)
  status?: GroupStatus;

  /** Oylik to'lov narxi (so'm). `null` — guruh narxi olib tashlanadi, filial narxi ishlatiladi */
  @ApiPropertyOptional({ example: 1000000, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  monthlyFee?: number | null;
}
