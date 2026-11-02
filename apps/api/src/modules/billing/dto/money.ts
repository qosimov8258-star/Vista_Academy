import { applyDecorators } from "@nestjs/common";
import { IsInt, IsPositive, Max, Min } from "class-validator";

/** Bazadagi Decimal(12, 2) ga sig'adigan eng katta summa — undan kattasi 500 xato berardi */
export const MAX_MONEY = 9_999_999_999;
const TOO_BIG = "Summa juda katta — eng ko'pi 9 999 999 999 so'm";

/** To'lov/hisob/xarajat summasi: musbat, butun so'm */
export function MoneyAmount() {
  return applyDecorators(
    IsInt({ message: "Summa butun so'mda bo'lishi kerak" }),
    IsPositive({ message: "Summa 0 dan katta bo'lishi kerak" }),
    Max(MAX_MONEY, { message: TOO_BIG }),
  );
}

/** Chegirma summasi: 0 ham bo'lishi mumkin */
export function DiscountAmount() {
  return applyDecorators(
    IsInt({ message: "Chegirma butun so'mda bo'lishi kerak" }),
    Min(0, { message: "Chegirma 0 dan kichik bo'lmasin" }),
    Max(MAX_MONEY, { message: TOO_BIG }),
  );
}
