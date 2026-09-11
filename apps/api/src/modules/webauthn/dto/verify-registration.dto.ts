import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export class VerifyRegistrationDto {
  @ApiProperty({ description: "@simplewebauthn/browser'ning startRegistration() natijasi" })
  @IsObject()
  response!: RegistrationResponseJSON;

  @ApiPropertyOptional({ example: "iPhone 15" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceName?: string;
}
