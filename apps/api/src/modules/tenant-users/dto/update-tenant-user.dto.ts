import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { SUPER_ADMIN_CREATABLE_ROLES, SuperAdminCreatableRole } from "./create-tenant-user.dto";

export class UpdateTenantUserDto {
  @ApiPropertyOptional({ example: "Aziz Rahimov" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @ApiPropertyOptional({
    enum: SUPER_ADMIN_CREATABLE_ROLES,
    description:
      "Faqat Super Admin o'zgartira oladi va faqat filial admini / moliyachi orasida. O'qituvchi roli bu yerdan o'zgartirilmaydi — u xodim kartochkasiga bog'langan.",
  })
  @IsOptional()
  @IsIn(SUPER_ADMIN_CREATABLE_ROLES)
  role?: SuperAdminCreatableRole;

  @ApiPropertyOptional({ example: "YangiParol123!", description: "Berilsa parol almashtiriladi va barcha seanslar yopiladi" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class SetTenantUserStatusDto {
  @ApiPropertyOptional({ example: false, description: "false — hisobni bloklash, true — blokdan chiqarish" })
  @IsBoolean()
  isActive!: boolean;
}
