import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

/** Super Admin faqat shu ikki rolni yarata oladi. */
export const SUPER_ADMIN_CREATABLE_ROLES = ["BRANCH_ADMIN", "FINANCE"] as const;
export type SuperAdminCreatableRole = (typeof SUPER_ADMIN_CREATABLE_ROLES)[number];

export class CreateTenantUserDto {
  @ApiProperty({ description: "NETWORK_ADMIN yaratayotganda majburiy; BRANCH_ADMIN uchun e'tiborga olinmaydi (o'z filiali ishlatiladi)" })
  @IsString()
  branchId!: string;

  @ApiPropertyOptional({
    enum: SUPER_ADMIN_CREATABLE_ROLES,
    default: "BRANCH_ADMIN",
    description:
      "Faqat NETWORK_ADMIN (Super Admin) uchun: filial admini yoki moliyachi. BRANCH_ADMIN chaqirsa e'tiborga olinmaydi — u doim MANAGER yaratadi.",
  })
  @IsOptional()
  @IsIn(SUPER_ADMIN_CREATABLE_ROLES)
  role?: SuperAdminCreatableRole;

  @ApiProperty({ example: "Aziz Rahimov" })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: "director@kids.uz" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "ChangeMe123!" })
  @IsString()
  @MinLength(8)
  password!: string;
}
