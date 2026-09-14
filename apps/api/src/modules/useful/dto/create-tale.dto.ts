import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { UsefulStatus } from "@prisma/client";

/** Hozircha tayyor rasmlardan biri — frontendda "tun" / "sholgom" chizilgan. */
const TALE_COVERS = ["tun", "sholgom"] as const;

export class CreateTaleDto {
  @ApiProperty({ example: "Sholg'om" })
  @IsString()
  @MaxLength(80)
  title!: string;

  @ApiProperty({ example: "Rus xalq ertagi", description: "\"O'zbek xalq ertagi\", muallif ismi va h.k." })
  @IsString()
  @MaxLength(120)
  origin!: string;

  @ApiProperty({
    description: "Xatboshilar orasida bitta bo'sh qator qoldiring — server ularni ajratadi",
    example: "1-xatboshi…\n\n2-xatboshi…",
  })
  @IsString()
  @MaxLength(8000)
  text!: string;

  @ApiProperty({ example: "Birga, ahil bo'lsak — har qanday ishni uddalaymiz." })
  @IsString()
  @Length(3, 300)
  moral!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ["Bobo bahorda nima ekdi?", "Eng oxirida kim yordamga keldi?"],
    description: "0–8 ta, har biri 3–150 belgi",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @Length(3, 150, { each: true })
  questions?: string[];

  @ApiPropertyOptional({ nullable: true, description: "null — server so'z soniga qarab hisoblaydi" })
  @IsOptional()
  @IsInt()
  @Min(1)
  minutes?: number | null;

  @ApiPropertyOptional({ enum: TALE_COVERS, default: "tun" })
  @IsOptional()
  @IsIn(TALE_COVERS)
  cover?: string;

  @ApiPropertyOptional({ nullable: true, description: "null — butun filial uchun (faqat admin/menejer)" })
  @IsOptional()
  @IsString()
  groupId?: string | null;

  @ApiPropertyOptional({ example: 3, default: 3, minimum: 2, maximum: 7 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(7)
  ageFrom?: number;

  @ApiPropertyOptional({ example: 7, default: 7, minimum: 2, maximum: 7 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(7)
  ageTo?: number;

  @ApiPropertyOptional({ enum: UsefulStatus, default: UsefulStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(UsefulStatus)
  status?: UsefulStatus;
}
