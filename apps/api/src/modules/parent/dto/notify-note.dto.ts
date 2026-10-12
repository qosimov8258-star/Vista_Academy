import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class NotifyNoteDto {
  @ApiProperty({ example: "Ertaga soat 12:00 da dori berish kerak" })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}
