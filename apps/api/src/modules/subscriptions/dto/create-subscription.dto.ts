import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsString()
  organizationId!: string;

  @ApiProperty()
  @IsString()
  planId!: string;
}
