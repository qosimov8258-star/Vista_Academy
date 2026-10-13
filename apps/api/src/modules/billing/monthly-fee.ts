import type { Prisma } from "@prisma/client";

/** Bolaning oylik narxi: guruh narxi, u bo'lmasa filial narxi (yo'q bo'lsa 0) */
export function monthlyFeeOf(
  group: { monthlyFee: Prisma.Decimal | null } | null | undefined,
  branch: { defaultTuitionAmount: Prisma.Decimal | null },
): number {
  return Number(group?.monthlyFee ?? branch.defaultTuitionAmount ?? 0);
}
