import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { LOGIN_PATTERN, LOGIN_PATTERN_MESSAGE } from "../../../common/validators/login";

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: "aziza_karimova" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(LOGIN_PATTERN, { message: LOGIN_PATTERN_MESSAGE })
  login?: string;

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
