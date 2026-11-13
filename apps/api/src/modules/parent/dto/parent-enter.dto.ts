import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ParentEnterDto {
  @ApiProperty({ description: "«Ota-ona profiliga kirish» bir martalik chiptasi" })
  @IsString()
  @MinLength(20)
  ticket!: string;
}
