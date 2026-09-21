import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MinLength } from "class-validator";

export class CreateTeacherDto {
  @ApiProperty({ example: "Dilnoza Qosimova" })
  @IsString()
  @MinLength(2)
  fullName!: string;

  @ApiProperty({ example: "Bosh tarbiyachi" })
  @IsString()
  @MinLength(2)
  role!: string;

  @ApiPropertyOptional({ example: "10 yillik tajribaga ega, ingliz tili bo'yicha sertifikatlangan" })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}
