import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class DeleteBranchDto {
  /** Tasdiqlash: filial nomi aynan yoziladi — tasodifiy o'chirishdan himoya. */
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  confirmName!: string;
}
