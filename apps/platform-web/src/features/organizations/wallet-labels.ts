import type { WalletTransactionType } from "@/lib/types";

export const WALLET_TX_TYPE_LABEL: Record<WalletTransactionType, string> = {
  TOP_UP: "To'ldirish",
  SUBSCRIPTION_CHARGE: "Obuna to'lovi",
  REFUND: "Qaytarish",
  BONUS: "Bonus",
  ADJUSTMENT: "Tuzatish",
};
