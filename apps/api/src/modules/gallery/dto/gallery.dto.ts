import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";
import { IMAGE_DATA_URL_MESSAGE, IMAGE_DATA_URL_RE } from "../../useful/content-scope";

/** Bitta ishga ko'pi bilan nechta rasm (guruh bo'linib suratga olinadi) */
export const GALLERY_MAX_IMAGES = 5;
/** Ish ostidagi matn uzunligi */
export const GALLERY_TEXT_MAX = 500;

export class CreateGalleryItemDto {
  @ApiProperty({ description: "Qaysi guruh bolalarining ishi" })
  @IsUUID("4", { message: "Guruhni tanlang" })
  groupId!: string;

  @ApiPropertyOptional({ example: "Quyoshli uy" })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: "Nomi 80 belgidan oshmasin" })
  title?: string | null;

  @ApiPropertyOptional({ example: "Bugun kuzgi barglar bilan applikatsiya qildik" })
  @IsOptional()
  @IsString()
  @MaxLength(GALLERY_TEXT_MAX, { message: `Matn ${GALLERY_TEXT_MAX} belgidan oshmasin` })
  description?: string | null;

  /** Eski usul: bitta rasm. Yangisi — `images` */
  @ApiPropertyOptional({ description: "data:image/...;base64 (brauzerda 1280px gacha kichraytiriladi)" })
  @IsOptional()
  @IsString()
  @Matches(IMAGE_DATA_URL_RE, { message: IMAGE_DATA_URL_MESSAGE })
  image?: string;

  /** 1–5 ta rasm, ko'rsatilish tartibida (birinchisi — muqova) */
  @ApiPropertyOptional({ type: [String], description: "1–5 ta data:image/...;base64" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(GALLERY_MAX_IMAGES, { message: `Ko'pi bilan ${GALLERY_MAX_IMAGES} ta rasm` })
  @IsString({ each: true })
  @Matches(IMAGE_DATA_URL_RE, { each: true, message: IMAGE_DATA_URL_MESSAGE })
  images?: string[];
}

export class UpdateGalleryItemDto {
  @ApiPropertyOptional({ example: "Quyoshli uy" })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: "Nomi 80 belgidan oshmasin" })
  title?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(GALLERY_TEXT_MAX, { message: `Matn ${GALLERY_TEXT_MAX} belgidan oshmasin` })
  description?: string | null;
}

export class GalleryQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() groupId?: string;
  @ApiPropertyOptional({ description: "Faqat Super Admin uchun" }) @IsOptional() @IsString() branchId?: string;
}
