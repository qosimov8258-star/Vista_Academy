import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class EmployeeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ description: "true bo'lsa faqat faol xodimlar (masalan smena/oylik uchun tanlovda)" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  /**
   * Arxiv: berilmasa — faqat ishlayotganlar (arxivdagilar ro'yxat va tanlovlarda
   * chiqmaydi); "only" — faqat arxiv; "all" — hammasi (tarix sahifalarida ism uchun).
   */
  @ApiPropertyOptional({ enum: ["only", "all"] })
  @IsOptional()
  @IsIn(["only", "all"])
  archived?: "only" | "all";
}
