import type { Prisma } from "@prisma/client";

/** Bolaning oylik narxi: bolaning o'z narxi, bo'lmasa guruh narxi, u ham bo'lmasa filial narxi (yo'q bo'lsa 0) */
export function monthlyFeeOf(
  group: { monthlyFee: Prisma.Decimal | null } | null | undefined,
  branch: { defaultTuitionAmount: Prisma.Decimal | null },
  child?: { monthlyFee: Prisma.Decimal | null } | null,
): number {
  return Number(child?.monthlyFee ?? group?.monthlyFee ?? branch.defaultTuitionAmount ?? 0);
}
