import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class UpdateOrganizationFeaturesDto {
  @ApiProperty({
    example: { crm: false, faceId: true, hr: null },
    description: "true — majburan yoqish, false — majburan o'chirish, null — tarifga qaytarish",
  })
  @IsObject()
  overrides!: Record<string, boolean | null>;
}
