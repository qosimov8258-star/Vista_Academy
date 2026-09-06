import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class CreateTenantUserDto {
  @ApiProperty({ description: "NETWORK_ADMIN yaratayotganda majburiy; BRANCH_ADMIN uchun e'tiborga olinmaydi (o'z filiali ishlatiladi)" })
  @IsString()
  branchId!: string;

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
