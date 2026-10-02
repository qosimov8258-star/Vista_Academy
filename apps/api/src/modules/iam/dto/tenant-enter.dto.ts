import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

/** Platforma bergan bir martalik "bog'chaga kirish" chiptasi. */
export class TenantEnterDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  ticket!: string;
}
