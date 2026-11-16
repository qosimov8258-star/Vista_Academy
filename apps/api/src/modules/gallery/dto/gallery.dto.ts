import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { IMAGE_DATA_URL_MESSAGE, IMAGE_DATA_URL_RE } from "../../useful/content-scope";

export class CreateGalleryItemDto {
  @ApiProperty({ description: "Qaysi guruh bolalarining ishi" })
  @IsUUID("4", { message: "Guruhni tanlang" })
  groupId!: string;

  @ApiPropertyOptional({ example: "Quyoshli uy" })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: "Nomi 80 belgidan oshmasin" })
  title?: string | null;

  @ApiProperty({ description: "data:image/...;base64 (brauzerda 1280px gacha kichraytiriladi)" })
  @IsString()
  @Matches(IMAGE_DATA_URL_RE, { message: IMAGE_DATA_URL_MESSAGE })
  image!: string;
}

export class UpdateGalleryItemDto {
  @ApiPropertyOptional({ example: "Quyoshli uy" })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: "Nomi 80 belgidan oshmasin" })
  title?: string | null;
}

export class GalleryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() groupId?: string;
  @ApiPropertyOptional({ description: "Faqat Super Admin uchun" }) @IsOptional() @IsString() branchId?: string;
}
