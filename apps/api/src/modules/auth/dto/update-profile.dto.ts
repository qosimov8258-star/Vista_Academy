import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: "aziza@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ required: false, example: "Aziza" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiProperty({ required: false, example: "Karimova" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiProperty({ required: false, example: "+998901234567" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
