import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";
import { PARENT_PAGES, type ParentPage } from "../parent-activity.constants";

export class StartParentPageViewDto {
  @ApiProperty({ enum: PARENT_PAGES })
  @IsIn(PARENT_PAGES as unknown as string[])
  page!: ParentPage;

  @ApiPropertyOptional({ description: "Kabinetda tanlangan farzand" })
  @IsOptional()
  @IsUUID()
  childId?: string;
}

export class PingParentPageViewDto {
  @ApiPropertyOptional({ description: "true — tab yana ko'rindi: oradagi yopiq vaqt qo'shilmaydi, faqat hisob qayta boshlanadi" })
  @IsOptional()
  @IsBoolean()
  resume?: boolean;
}
