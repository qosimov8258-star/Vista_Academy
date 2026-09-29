import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RejectPaymentReceiptDto {
  @ApiProperty({ description: "Rad etish sababi — masalan, chek soxta yoki summa mos kelmaydi" })
  @IsString()
  @MinLength(3, { message: "Izoh kamida 3 belgi bo'lishi kerak" })
  comment!: string;
}
