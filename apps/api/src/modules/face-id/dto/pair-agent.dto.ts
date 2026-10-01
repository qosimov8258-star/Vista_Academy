import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength } from "class-validator";

export class PairAgentDto {
  @ApiProperty({ example: "K7Q2-M9XD", description: "ERP'dagi \"Agentni ulash\" bergan bir martalik kod" })
  @IsString()
  @Matches(/^[A-Za-z0-9 -]{8,12}$/, { message: "Ulash kodi noto'g'ri formatda (masalan K7Q2-M9XD)" })
  code!: string;

  @ApiProperty({ example: "Qabulxona-PC", description: "Agent o'rnatilgan kompyuter nomi" })
  @IsString()
  @MaxLength(100)
  name!: string;
}
