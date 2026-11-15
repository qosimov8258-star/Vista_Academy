import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArticleReactionKind } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, Length, ValidateIf } from "class-validator";

/** Layk/dizlayk. `null` — bahoni olib tashlash */
export class ArticleReactionDto {
  @ApiProperty({ enum: ArticleReactionKind, nullable: true })
  @ValidateIf((dto: ArticleReactionDto) => dto.kind !== null)
  @IsEnum(ArticleReactionKind, { message: "Baho noto'g'ri" })
  kind!: ArticleReactionKind | null;
}

export class CreateArticleCommentDto {
  @ApiProperty({ example: "Rahmat, juda foydali maslahat!" })
  @IsString()
  @Length(1, 1000, { message: "Izoh 1–1000 belgi bo'lsin" })
  body!: string;

  @ApiPropertyOptional({ description: "Javob bo'lsa — qaysi izohga" })
  @IsOptional()
  @IsUUID("4", { message: "Izoh topilmadi" })
  parentId?: string;
}
