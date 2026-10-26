import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { MATERIAL_LIMITS } from "../group-materials.constants";

/** `multipart/form-data` matn maydonlari; fayl `file` maydonida keladi. */
export class UploadMaterialDto {
  @ApiPropertyOptional({ maxLength: MATERIAL_LIMITS.titleMaxLength, description: "Bo'sh bo'lsa fayl nomi olinadi" })
  @IsOptional()
  @IsString()
  @MaxLength(MATERIAL_LIMITS.titleMaxLength)
  title?: string;

  @ApiPropertyOptional({ maxLength: MATERIAL_LIMITS.descriptionMaxLength })
  @IsOptional()
  @IsString()
  @MaxLength(MATERIAL_LIMITS.descriptionMaxLength)
  description?: string;
}
