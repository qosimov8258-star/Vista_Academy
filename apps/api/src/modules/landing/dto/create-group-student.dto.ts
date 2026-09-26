import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateGroupStudentDto {
  @ApiProperty({ example: "Amir Vositov" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: "Rasm chizishni va qo'shiq aytishni yaxshi ko'radi." })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}
