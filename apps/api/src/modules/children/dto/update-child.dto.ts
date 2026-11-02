import { ApiPropertyOptional } from "@nestjs/swagger";
import { Gender } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, MinLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class UpdateChildDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  lastName?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  // Guruhdan chiqarish uchun `null` ham qabul qilinadi — shuning uchun
  // DTO darajasida emas, controller/service'da alohida tekshiriladi.
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  groupId?: string | null;

  // QUARANTINED bu yerdan qo'yilmaydi — u sababi bilan birga alohida
  // `/quarantine` endpointidan boshqariladi.
  @ApiPropertyOptional({ enum: ["ACTIVE", "INACTIVE"] })
  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE"])
  status?: "ACTIVE" | "INACTIVE";

  /** Xodim tasdiqladi: guruh to'lgan bo'lsa ham qo'shilsin */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowOverCapacity?: boolean;
}
