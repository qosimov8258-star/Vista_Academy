import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, Max, Min } from "class-validator";

export class ExtendSubscriptionDto {
  @ApiProperty({ minimum: 1, maximum: 24 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months!: number;

  /** true — hamyondan (narx × oy) yechiladi; false — bepul uzaytirish. */
  @ApiProperty()
  @IsBoolean()
  charge!: boolean;
}
