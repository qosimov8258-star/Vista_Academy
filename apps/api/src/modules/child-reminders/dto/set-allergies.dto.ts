import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class SetAllergiesDto {
  @ApiProperty({ example: "sut, yong'oq", description: "Bo'sh qator — allergiya yo'q" })
  @IsString()
  @MaxLength(300)
  allergies!: string;
}
