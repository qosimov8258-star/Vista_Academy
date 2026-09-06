import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { GuardianRelation } from "@prisma/client";

export class UpdateChildGuardianDto {
  @ApiPropertyOptional({ enum: GuardianRelation })
  @IsOptional()
  @IsEnum(GuardianRelation)
  relation?: GuardianRelation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canPickup?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canViewFinance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canReceiveNotifications?: boolean;
}
