import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class DeviceQueryDto {
  @ApiPropertyOptional({ description: "NETWORK_ADMIN uchun ixtiyoriy filtr — boshqa rollarda o'z filiali ustunlik qiladi" })
  @IsOptional()
  @IsString()
  branchId?: string;
}
