import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Length } from "class-validator";
import { UsefulStatus } from "@prisma/client";

export class UpdateProverbDto {
  @ApiPropertyOptional({ example: "Mehnatning tagi — rohat." })
  @IsOptional()
  @IsString()
  @Length(3, 160)
  text?: string;

  @ApiPropertyOptional({ example: "Kim harakat qilsa, keyin quvonchini ko'radi." })
  @IsOptional()
  @IsString()
  @Length(3, 400)
  meaning?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  groupId?: string | null;

  @ApiPropertyOptional({ enum: UsefulStatus })
  @IsOptional()
  @IsEnum(UsefulStatus)
  status?: UsefulStatus;
}
