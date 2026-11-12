import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export const BROADCAST_AUDIENCES = ["GUARDIANS", "EMPLOYEES"] as const;
export type BroadcastAudienceKey = (typeof BROADCAST_AUDIENCES)[number];

/**
 * Kimga:
 * - `BRANCH` — butun filial (hamma ota-ona yoki kabineti bor hamma xodim);
 * - `GROUPS` — tanlangan guruhlar (ota-onalari yoki tarbiyachilari);
 * - `PICKED` — tanlangan bolalar ota-onasi (`childIds`) yoki xodimlar (`employeeIds`).
 */
export const BROADCAST_SCOPES = ["BRANCH", "GROUPS", "PICKED"] as const;
export type BroadcastScopeKey = (typeof BROADCAST_SCOPES)[number];

export const BROADCAST_LIMITS = { title: 120, body: 2000, picked: 500, groups: 100 } as const;

export class BroadcastTargetDto {
  @ApiProperty({ enum: BROADCAST_AUDIENCES })
  @IsIn(BROADCAST_AUDIENCES)
  audience!: BroadcastAudienceKey;

  @ApiProperty({ enum: BROADCAST_SCOPES })
  @IsIn(BROADCAST_SCOPES)
  scope!: BroadcastScopeKey;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BROADCAST_LIMITS.groups)
  @IsUUID("all", { each: true })
  groupIds?: string[];

  @ApiPropertyOptional({ type: [String], description: "PICKED + GUARDIANS: shu bolalarning ota-onasi" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BROADCAST_LIMITS.picked)
  @IsUUID("all", { each: true })
  childIds?: string[];

  @ApiPropertyOptional({ type: [String], description: "PICKED + EMPLOYEES" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(BROADCAST_LIMITS.picked)
  @IsUUID("all", { each: true })
  employeeIds?: string[];
}

export class CreateBroadcastDto extends BroadcastTargetDto {
  @ApiProperty({ example: "Ertaga dam olish kuni" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(BROADCAST_LIMITS.title)
  title!: string;

  @ApiProperty({ example: "Hurmatli ota-onalar, 14-noyabr bog'cha ishlamaydi." })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(BROADCAST_LIMITS.body)
  body!: string;

  @ApiPropertyOptional({ description: "Ochilmaguncha kabinetda yopilmaydigan oyna chiqadi" })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;
}

export class BroadcastListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}
