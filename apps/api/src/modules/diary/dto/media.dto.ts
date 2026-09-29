import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { DIARY_LIMITS } from "../diary.constants";

/**
 * `multipart/form-data` dagi matn maydonlari (fayllar: `file` majburiy,
 * `poster` — video uchun ixtiyoriy muqova kadri). Raqamlar satr bo'lib
 * keladi, shuning uchun `@Type(() => Number)`.
 */
export class UploadMediaDto {
  @ApiPropertyOptional({ maxLength: DIARY_LIMITS.captionMaxLength })
  @IsOptional()
  @IsString()
  @MaxLength(DIARY_LIMITS.captionMaxLength)
  caption?: string;

  @ApiPropertyOptional({ description: "Qaysi mashg'ulot belgisiga biriktiriladi (shu kungi)" })
  @IsOptional()
  @IsUUID()
  entryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  height?: number;

  @ApiPropertyOptional({ description: "Video davomiyligi, soniya" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(600)
  durationSeconds?: number;
}

export class UpdateMediaDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(DIARY_LIMITS.captionMaxLength)
  caption?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "null — mashg'ulotdan ajratish" })
  @IsOptional()
  @IsUUID()
  entryId?: string | null;
}

export class DaysQueryDto {
  @ApiPropertyOptional({ example: "2026-09-01" })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: "2026-09-16" })
  @IsOptional()
  @IsString()
  to?: string;
}
