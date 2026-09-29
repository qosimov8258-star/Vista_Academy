import { ApiPropertyOptional } from "@nestjs/swagger";
import { FaceIdDeviceStatus } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

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

  @ApiPropertyOptional({ example: 80, description: "ISAPI (HTTP) porti" })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ example: "admin", description: "Qurilma administratori logini" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @ApiPropertyOptional({ description: "Qurilma paroli — shifrlab saqlanadi, hech qachon qaytarilmaydi. Bo'sh qator — parolni o'chirish" })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

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
