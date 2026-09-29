import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class AgentCommandAckDto {
  @ApiProperty()
  @IsBoolean()
  success!: boolean;

  @ApiPropertyOptional({ description: "Muvaffaqiyatsiz bo'lsa — ISAPI statusCode/subStatusCode va xabar" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  error?: string;
}
