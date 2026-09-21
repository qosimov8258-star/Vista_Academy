import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class SellProductDto {
  @ApiProperty({ example: 1, description: "Sotiladigan son" })
  @IsInt()
  @Min(1)
  quantity!: number;
}
