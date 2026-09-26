import { ApiPropertyOptional } from "@nestjs/swagger";
import { FaceIdDeviceStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: FaceIdDeviceStatus })
  @IsOptional()
  @IsEnum(FaceIdDeviceStatus)
  status?: FaceIdDeviceStatus;
}
