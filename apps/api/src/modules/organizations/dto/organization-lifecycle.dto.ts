import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class SuspendOrganizationDto {
  /** Bog'cha xodimlariga kirishda ko'rsatiladi. */
  @ApiPropertyOptional({ example: "Obuna to'lovi kechikdi" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ArchiveOrganizationDto {
  /** Tasdiqlash: bog'cha slug'i aynan yoziladi. */
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  confirmSlug!: string;
}
