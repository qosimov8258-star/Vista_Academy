import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class UpdateContentBlockDto {
  @ApiProperty({ example: "Doimiy tarbiyachi" })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: "Har bir guruhda o'quv yili davomida bitta doimiy tarbiyachi ishlaydi..." })
  @IsString()
  @MinLength(2)
  body!: string;
}
