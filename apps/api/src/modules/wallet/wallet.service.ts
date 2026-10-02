import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, WalletTransactionType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { SubscriptionBillingService } from "../subscriptions/subscription-billing.service";
import { TopUpWalletDto } from "./dto/top-up-wallet.dto";
import { AdjustWalletDto } from "./dto/adjust-wallet.dto";

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: SubscriptionBillingService,
  ) {}

  async getByOrganization(organizationId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { organizationId } });
    if (!wallet) throw new NotFoundException("Bu bog'cha uchun hamyon topilmadi");
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { createdByUser: { select: { id: true, fullName: true, login: true } } },
    });
    return { wallet, transactions };
  }

  async topUp(organizationId: string, dto: TopUpWalletDto, createdByUserId: string) {
    const result = await this.applyTransaction(organizationId, {
      type: WalletTransactionType.TOP_UP,
      amount: new Prisma.Decimal(dto.amount),
      note: dto.note,
      createdByUserId,
    });
    return { ...result, subscription: await this.settleAfterCredit(organizationId) };
  }

  async adjust(organizationId: string, dto: AdjustWalletDto, createdByUserId: string) {
    const result = await this.applyTransaction(organizationId, {
      type: dto.type,
      amount: new Prisma.Decimal(dto.amount),
      note: dto.note,
      createdByUserId,
    });
    return {
      ...result,
      subscription: result.transaction.amount.greaterThan(0) ? await this.settleAfterCredit(organizationId) : "noop",
    };
  }

  /**
   * Pul tushgach obuna darhol hisob-kitob qilinadi: imtiyozli davrdagi yoki
   * billing to'xtatgan bog'cha cron'ni (15 daqiqa) kutmasdan ochiladi.
   * Xato bo'lsa to'ldirish baribir muvaffaqiyatli — cron keyin qayta urinadi.
   */
  private async settleAfterCredit(organizationId: string) {
    try {
      return await this.billing.settle(organizationId);
    } catch {
      return "noop" as const;
    }
  }

  private async applyTransaction(
    organizationId: string,
    input: { type: WalletTransactionType; amount: Prisma.Decimal; note?: string; createdByUserId: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Qatorni qulflaymiz: bir vaqtdagi ikki amal (yoki obuna yechimi) bir-birining
      // balansini bosib ketmasin — ilgari o'qish va yozish orasida qulf yo'q edi
      await tx.$queryRaw`SELECT id FROM wallets WHERE organization_id = ${organizationId} FOR UPDATE`;
      const wallet = await tx.wallet.findUnique({ where: { organizationId } });
      if (!wallet) throw new NotFoundException("Bu bog'cha uchun hamyon topilmadi");

      const balanceAfter = wallet.balance.add(input.amount);
      if (balanceAfter.lessThan(0)) {
        throw new ConflictException("Hamyon balansi manfiy bo'lishi mumkin emas");
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: input.type,
          amount: input.amount,
          balanceAfter,
          note: input.note,
          createdByUserId: input.createdByUserId,
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }
}
