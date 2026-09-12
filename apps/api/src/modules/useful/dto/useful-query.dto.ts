import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { UsefulStatus } from "@prisma/client";

export class UsefulQueryDto {
  @ApiPropertyOptional({ description: "Faqat shu guruh (yoki butun filial uchun bo'sh qoldiring)" })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ enum: UsefulStatus, description: "Bo'sh qoldirilsa — hammasi (qoralama + chop etilgan)" })
  @IsOptional()
  @IsEnum(UsefulStatus)
  status?: UsefulStatus;

  @ApiPropertyOptional({ description: "Faqat NETWORK_ADMIN uchun — filialni tanlash, bo'sh bo'lsa barcha filiallar" })
  @IsOptional()
  @IsString()
  branchId?: string;
}
