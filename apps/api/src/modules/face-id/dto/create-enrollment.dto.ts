import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FacePersonType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

/**
 * Yuzni ro'yxatga olishga topshirish. `branchId` bu yerda yo'q — xuddi
 * `CreateDeviceDto` kabi, filial `requireOperationalScope(scope)` orqali
 * serverda aniqlanadi. `employeeId`/`childId`dan aynan bittasi `personType`ga
 * mos ravishda to'ldirilishi kerak — bu servis darajasida tekshiriladi.
 */
export class CreateEnrollmentDto {
  @ApiProperty()
  @IsString()
  deviceId!: string;

  @ApiProperty({ enum: FacePersonType })
  @IsEnum(FacePersonType)
  personType!: FacePersonType;

  @ApiPropertyOptional({ description: "personType === EMPLOYEE bo'lsa majburiy" })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: "personType === CHILD bo'lsa majburiy" })
  @IsOptional()
  @IsString()
  childId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
