import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { OrganizationStatus } from "@prisma/client";

export const ORGANIZATION_SORTS = ["created", "name", "children", "balance"] as const;
export type OrganizationSort = (typeof ORGANIZATION_SORTS)[number];

export class OrganizationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: "Nomi, manzili (slug), telefon yoki email bo'yicha qidiruv" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: OrganizationStatus })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiPropertyOptional({ enum: ORGANIZATION_SORTS, default: "created" })
  @IsOptional()
  @IsIn(ORGANIZATION_SORTS)
  sort?: OrganizationSort;
}
