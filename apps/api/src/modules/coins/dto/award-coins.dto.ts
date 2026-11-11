import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/** Tarbiyachi o'z guruhidagi bolaga qo'lda yulduzcha beradi. */
export class AwardCoinsDto {
  /** Bir martada beriladigan yulduzcha. Yuqori chegara faqat adashib ko'p yozib yuborishdan saqlaydi — necha marta berish cheklanmaydi. */
  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(100)
  amount!: number;

  @ApiPropertyOptional({ example: "Darsda faol bo'ldi" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}
