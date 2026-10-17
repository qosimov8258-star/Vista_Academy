import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Max, Min, ValidateIf } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateRoomDto {
  @ApiProperty({ example: "1-xona" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Xona nomini kiriting" })
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({ example: 20, description: "Necha bola sig'adi; bo'sh — chegarasiz" })
  @IsOptional()
  @IsInt({ message: "Sig'im butun son bo'lishi kerak" })
  @Min(1, { message: "Sig'im kamida 1" })
  @Max(500)
  capacity?: number;
}

export class UpdateRoomDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Xona nomini kiriting" })
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({ nullable: true, type: Number, description: "null — chegarasiz" })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: "Sig'im butun son bo'lishi kerak" })
  @Min(1, { message: "Sig'im kamida 1" })
  @Max(500)
  capacity?: number | null;

  @ApiPropertyOptional({ description: "Ishlatilmayotgan xona tanlov ro'yxatida chiqmaydi" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RoomQueryDto {
  @ApiPropertyOptional({ description: "Filial darajasidagi foydalanuvchilar uchun shart emas" })
  @IsOptional()
  @IsString()
  branchId?: string;
}
