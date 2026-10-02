import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { OrganizationStatus } from "@prisma/client";

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ nullable: true, description: "null yuborilsa tozalanadi" })
  @IsOptional()
  @IsString()
  contactName?: string | null;

  /** Mustaqil lending sayt domeni — shu domendan kelgan arizalar shu tashkilotga bog'lanadi. null yuborilsa tozalanadi. */
  @ApiPropertyOptional({ example: "vista-academy.uz", nullable: true, description: "null yuborilsa tozalanadi" })
  @IsOptional()
  @IsString()
  website?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "null yuborilsa tozalanadi" })
  @IsOptional()
  @IsEmail()
  contactEmail?: string | null;

  @ApiPropertyOptional({ nullable: true, description: "null yuborilsa tozalanadi" })
  @IsOptional()
  @IsString()
  contactPhone?: string | null;

  /** Arxiv faqat alohida `POST :id/archive` orqali (slug tasdig'i bilan). */
  @ApiPropertyOptional({ enum: ["ACTIVE", "SUSPENDED"] })
  @IsOptional()
  @IsIn(["ACTIVE", "SUSPENDED"])
  status?: Extract<OrganizationStatus, "ACTIVE" | "SUSPENDED">;

  /** Operatorning ichki izohi — bog'chaga ko'rinmaydi. null yuborilsa tozalanadi. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
