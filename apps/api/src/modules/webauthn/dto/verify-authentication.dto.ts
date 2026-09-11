import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

export class VerifyAuthenticationDto {
  @ApiProperty({ description: "@simplewebauthn/browser'ning startAuthentication() natijasi" })
  @IsObject()
  response!: AuthenticationResponseJSON;
}
