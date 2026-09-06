import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { GuardianRelation } from "@prisma/client";

export class AddChildGuardianDto {
  @ApiPropertyOptional({ description: "Mavjud guardian ID (agar aka-uka/opa-singil uchun oldin qo'shilgan bo'lsa)" })
  @IsOptional()
  @IsString()
  guardianId?: string;

  @ApiPropertyOptional({ example: "Karimova Aziza", description: "guardianId berilmagan bo'lsa majburiy" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({ example: "+998901234567", description: "guardianId berilmagan bo'lsa majburiy" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: GuardianRelation, default: "OTHER" })
  @IsOptional()
  @IsEnum(GuardianRelation)
  relation?: GuardianRelation;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canPickup?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canViewFinance?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canReceiveNotifications?: boolean;
}
