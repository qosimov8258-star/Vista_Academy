import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedParent } from "./parent-auth.types";
import { MAX_PING_GAP_SEC, type ParentPage } from "./parent-activity.constants";

/**
 * Ota-ona kabinetidagi faollikni yozadi: qaysi bo'limni, qaysi farzand
 * uchun, qancha vaqt ko'rgani. Vaqt server soati bo'yicha hisoblanadi —
 * brauzer faqat «hali shu yerdaman» deydi, necha soniya ekanini emas.
 */
@Injectable()
export class ParentActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async start(parent: AuthenticatedParent, page: ParentPage, childId?: string) {
    // Farzand shu ota-onaniki bo'lmasa — yozuv bolasiz saqlanadi (begona bola ID si yozilmaydi)
    let ownChildId: string | null = null;
    if (childId) {
      const link = await this.prisma.childGuardian.findFirst({
        where: { guardianId: parent.id, childId },
        select: { childId: true },
      });
      ownChildId = link?.childId ?? null;
    } else {
      // Bitta farzandli ota-onada kabinet tanlovni saqlamaydi — o'sha bola yoziladi
      const links = await this.prisma.childGuardian.findMany({
        where: { guardianId: parent.id, child: { status: { not: "INACTIVE" } } },
        select: { childId: true },
        take: 2,
      });
      if (links.length === 1) ownChildId = links[0].childId;
    }
    const view = await this.prisma.guardianPageView.create({
      data: { organizationId: parent.organizationId, guardianId: parent.id, childId: ownChildId, page },
      select: { id: true },
    });
    return { id: view.id };
  }

  async ping(parent: AuthenticatedParent, viewId: string, resume: boolean) {
    const view = await this.prisma.guardianPageView.findFirst({
      where: { id: viewId, guardianId: parent.id },
      select: { id: true, lastSeenAt: true },
    });
    if (!view) {
      throw new NotFoundException("Yozuv topilmadi");
    }
    const now = new Date();
    const gapSec = Math.floor((now.getTime() - view.lastSeenAt.getTime()) / 1000);
    const add = !resume && gapSec > 0 && gapSec <= MAX_PING_GAP_SEC ? gapSec : 0;
    await this.prisma.guardianPageView.update({
      where: { id: view.id },
      data: { lastSeenAt: now, ...(add ? { durationSec: { increment: add } } : {}) },
    });
    return { ok: true };
  }
}
