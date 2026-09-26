import { ApiPropertyOptional } from "@nestjs/swagger";
import { FaceEnrollmentStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateEnrollmentDto {
  @ApiPropertyOptional({ enum: FaceEnrollmentStatus })
  @IsOptional()
  @IsEnum(FaceEnrollmentStatus)
  status?: FaceEnrollmentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
