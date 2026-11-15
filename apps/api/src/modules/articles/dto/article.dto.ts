import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ArticleCategory, UsefulStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { IMAGE_DATA_URL_MESSAGE, IMAGE_DATA_URL_RE } from "../../useful/content-scope";

export class ArticleTipDto {
  @ApiProperty({ example: "Hissiyotni tan oling" })
  @IsString()
  @Length(2, 80, { message: "Maslahat sarlavhasi 2–80 belgi bo'lsin" })
  title!: string;

  @ApiProperty({ example: "Bolaga qo'rqish tabiiy ekanini va siz yonida ekaningizni ayting." })
  @IsString()
  @Length(2, 400, { message: "Maslahat matni 2–400 belgi bo'lsin" })
  text!: string;
}

export class CreateArticleDto {
  @ApiProperty({ enum: ArticleCategory })
  @IsEnum(ArticleCategory, { message: "Mavzu noto'g'ri" })
  category!: ArticleCategory;

  @ApiProperty({ example: "Bolaga qo'rquvni yengishda qanday yordam berish mumkin?" })
  @IsString()
  @Length(3, 140, { message: "Sarlavha 3–140 belgi bo'lsin" })
  title!: string;

  @ApiProperty({ description: "Ro'yxatda chiqadigan qisqa izoh" })
  @IsString()
  @Length(3, 300, { message: "Qisqa izoh 3–300 belgi bo'lsin" })
  summary!: string;

  @ApiProperty({ description: "Asosiy matn; xatboshilar bo'sh qator bilan ajratiladi" })
  @IsString()
  @Length(10, 12000, { message: "Matn 10–12000 belgi bo'lsin" })
  body!: string;

  @ApiPropertyOptional({ type: [ArticleTipDto], description: "«Hozir nima qilish mumkin» ro'yxati" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8, { message: "Ko'pi bilan 8 ta maslahat" })
  @ValidateNested({ each: true })
  @Type(() => ArticleTipDto)
  tips?: ArticleTipDto[];

  @ApiPropertyOptional({ description: "Pastdagi «Eslatma» bloki" })
  @IsOptional()
  @IsString()
  @MaxLength(400, { message: "Eslatma 400 belgidan oshmasin" })
  memo?: string | null;

  @ApiPropertyOptional({ description: "null — filialdagi barcha guruhlar (tarbiyachi uchun majburiy)" })
  @IsOptional()
  @IsString()
  groupId?: string | null;

  @ApiPropertyOptional({ enum: UsefulStatus })
  @IsOptional()
  @IsEnum(UsefulStatus)
  status?: UsefulStatus;

  @ApiPropertyOptional({ description: "Muqova: data:image/...;base64 (null — muqovani olib tashlash)" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(IMAGE_DATA_URL_RE, { message: IMAGE_DATA_URL_MESSAGE })
  cover?: string | null;
}

export class UpdateArticleDto extends PartialType(CreateArticleDto) {}

export class ArticleQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() groupId?: string;
  @ApiPropertyOptional({ enum: UsefulStatus }) @IsOptional() @IsEnum(UsefulStatus) status?: UsefulStatus;
  @ApiPropertyOptional({ enum: ArticleCategory }) @IsOptional() @IsEnum(ArticleCategory) category?: ArticleCategory;
  @ApiPropertyOptional({ description: "Faqat Super Admin uchun" }) @IsOptional() @IsString() branchId?: string;
}
