import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { ChangePlanDto } from "./dto/change-plan.dto";

const include = { organization: true, plan: true } as const;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.subscription.findMany({ include, orderBy: { createdAt: "desc" } });
  }

  async create(dto: CreateSubscriptionDto) {
    const [organization, plan, existing] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: dto.organizationId } }),
      this.prisma.plan.findUnique({ where: { id: dto.planId } }),
      this.prisma.subscription.findUnique({ where: { organizationId: dto.organizationId } }),
    ]);
    if (!organization) throw new NotFoundException("Bog'cha topilmadi");
    if (!plan) throw new NotFoundException("Reja topilmadi");
    if (existing) throw new ConflictException("Bog'chada obuna allaqachon mavjud, reja o'zgartirishdan foydalaning");

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.create({
      data: {
        organizationId: dto.organizationId,
        planId: dto.planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include,
    });
  }

  async changePlan(organizationId: string, dto: ChangePlanDto) {
    const subscription = await this.requireByOrganization(organizationId);
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException("Reja topilmadi");

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { planId: dto.planId },
      include,
    });
  }

  async setStatus(organizationId: string, status: SubscriptionStatus) {
    const subscription = await this.requireByOrganization(organizationId);
    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status, graceUntil: status === SubscriptionStatus.GRACE_PERIOD ? graceDeadline() : null },
      include,
    });
  }

  private async requireByOrganization(organizationId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!subscription) throw new NotFoundException("Bu bog'cha uchun obuna topilmadi");
    return subscription;
  }
}

function graceDeadline(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}
