import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Max, Min } from "class-validator";

export class NotifyDepartureDto {
  @ApiProperty({ example: 20, description: "Necha daqiqada yetib borishi" })
  @IsInt()
  @Min(1)
  @Max(120)
  minutes!: number;
}
