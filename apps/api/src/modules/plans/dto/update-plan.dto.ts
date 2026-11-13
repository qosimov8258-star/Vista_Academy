import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional } from "class-validator";
import { CreatePlanDto } from "./create-plan.dto";

export class UpdatePlanDto extends PartialType(OmitType(CreatePlanDto, ["features"] as const)) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Mavjud xaritaga QO'SHILADI (merge): berilgan kalitlar yangilanadi,
   * `null` — kalit olib tashlanadi (odatiy holat — yoqilgan), berilmagan
   * kalitlar o'zgarmaydi. Noma'lum kalit yoki boolean/null bo'lmagan qiymat — 400.
   */
  @ApiPropertyOptional({ example: { crm: false, hr: true, faceId: null } })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean | null>;
}
