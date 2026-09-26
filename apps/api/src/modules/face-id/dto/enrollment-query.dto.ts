import { ApiPropertyOptional } from "@nestjs/swagger";
import { FaceEnrollmentStatus, FacePersonType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class EnrollmentQueryDto {
  @ApiPropertyOptional({ description: "NETWORK_ADMIN uchun ixtiyoriy filtr — boshqa rollarda o'z filiali ustunlik qiladi" })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ enum: FacePersonType })
  @IsOptional()
  @IsEnum(FacePersonType)
  personType?: FacePersonType;

  @ApiPropertyOptional({ enum: FaceEnrollmentStatus })
  @IsOptional()
  @IsEnum(FaceEnrollmentStatus)
  status?: FaceEnrollmentStatus;
}
