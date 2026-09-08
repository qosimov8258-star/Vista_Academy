import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";
import { createChildWithGuardian, withPublicIdRetry } from "../children/child-creation";

/** "Umaraliyev Usmon" -> { lastName: "Umaraliyev", firstName: "Usmon" } */
function splitLeadChildName(value: string): { lastName: string; firstName: string } {
  const [first, ...rest] = value.trim().split(/\s+/);
  return { lastName: first ?? value.trim(), firstName: rest.join(" ") };
}
import { CreateLeadDto } from "./dto/create-lead.dto";
import { LeadQueryDto } from "./dto/lead-query.dto";
import { UpdateLeadStageDto } from "./dto/update-lead-stage.dto";
import { CreateLeadActivityDto } from "./dto/create-lead-activity.dto";
import { ConvertLeadDto } from "./dto/convert-lead.dto";

const leadInclude = {
  assignedTo: { select: { id: true, fullName: true } },
  activities: { orderBy: { createdAt: "desc" as const }, include: { createdBy: { select: { id: true, fullName: true } } } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: TenantAuthenticatedUser, dto: CreateLeadDto) {
    const scope = toTenantScope(user);
    const branchId = requireOperationalScope(scope);

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          childFullName: dto.childFullName,
          childBirthDate: dto.childBirthDate ? new Date(dto.childBirthDate) : undefined,
          ageGroup: dto.ageGroup,
          parentName: dto.parentName,
          parentPhone: dto.parentPhone,
          source: dto.source,
          assignedToUserId: user.id,
        },
      });
      await tx.leadActivity.create({
        data: { leadId: lead.id, type: "STAGE_CHANGE", note: "Ariza yaratildi", createdByUserId: user.id },
      });
      return tx.lead.findUniqueOrThrow({ where: { id: lead.id }, include: leadInclude });
    });
  }

  async findAll(scope: TenantScope, query: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
      ...(query.stage ? { stage: query.stage } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: { assignedTo: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data: items, meta: { page: query.page, limit: query.limit, total } };
  }

  async findOne(scope: TenantScope, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId: scope.organizationId },
      include: leadInclude,
    });
    if (!lead) {
      throw new NotFoundException("Ariza topilmadi");
    }
    if (scope.branchId && lead.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu arizaga kirish huquqingiz yo'q");
    }
    return lead;
  }

  async updateStage(user: TenantAuthenticatedUser, id: string, dto: UpdateLeadStageDto) {
    const scope = toTenantScope(user);
    const branchId = requireOperationalScope(scope);
    const lead = await this.prisma.lead.findFirst({ where: { id, organizationId: scope.organizationId } });
    if (!lead) {
      throw new NotFoundException("Ariza topilmadi");
    }
    if (lead.branchId !== branchId) {
      throw new ForbiddenException("Bu arizaga kirish huquqingiz yo'q");
    }
    if (dto.stage === "LOST" && !dto.lostReason) {
      throw new BadRequestException("Yo'qotilgan ariza uchun sabab kiritilishi shart");
    }
    if (dto.stage === "WON") {
      throw new BadRequestException("WON holatiga faqat 'bolaga aylantirish' orqali o'tish mumkin");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: { stage: dto.stage, lostReason: dto.stage === "LOST" ? dto.lostReason : null },
      });
      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: "STAGE_CHANGE",
          note: dto.stage === "LOST" ? `Yo'qotildi: ${dto.lostReason}` : `Bosqich: ${dto.stage}`,
          createdByUserId: user.id,
        },
      });
      return updated;
    });
  }

  async addActivity(user: TenantAuthenticatedUser, id: string, dto: CreateLeadActivityDto) {
    const scope = toTenantScope(user);
    const branchId = requireOperationalScope(scope);
    const lead = await this.prisma.lead.findFirst({ where: { id, organizationId: scope.organizationId } });
    if (!lead) {
      throw new NotFoundException("Ariza topilmadi");
    }
    if (lead.branchId !== branchId) {
      throw new ForbiddenException("Bu arizaga kirish huquqingiz yo'q");
    }
    return this.prisma.leadActivity.create({
      data: { leadId: id, type: dto.type, note: dto.note, createdByUserId: user.id },
    });
  }

  async convert(user: TenantAuthenticatedUser, id: string, dto: ConvertLeadDto) {
    const scope = toTenantScope(user);
    const branchId = requireOperationalScope(scope);
    const lead = await this.prisma.lead.findFirst({ where: { id, organizationId: scope.organizationId } });
    if (!lead) {
      throw new NotFoundException("Ariza topilmadi");
    }
    if (lead.branchId !== branchId) {
      throw new ForbiddenException("Bu arizaga kirish huquqingiz yo'q");
    }
    if (lead.stage === "WON" || lead.stage === "LOST") {
      throw new BadRequestException("Bu ariza allaqachon yakunlangan");
    }
    if (dto.groupId) {
      const group = await this.prisma.group.findFirst({ where: { id: dto.groupId, branchId } });
      if (!group) {
        throw new NotFoundException("Guruh topilmadi");
      }
    }

    // Bola qo'lda qo'shilgani bilan bir xil yo'ldan o'tadi: qisqa ID oladi va
    // arizadagi ota-ona ma'lumoti vasiy sifatida bog'lanadi. Arizada kim
    // ekani (ota/ona) so'ralmagani uchun aloqa turi OTHER bo'lib qoladi —
    // keyinchalik bolaning kartochkasidan aniqlashtiriladi.
    return withPublicIdRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const child = await createChildWithGuardian(
          tx,
          {
            organizationId: scope.organizationId,
            branchId,
            groupId: dto.groupId,
            // Arizada bola nomi bitta maydonda so'raladi. Birinchi so'zni
            // familiya deb olamiz ("Familiya Ism" konvensiyasi bo'yicha);
            // jins ham arizada so'ralmaydi, shuning uchun noma'lum qoladi va
            // bolaning kartochkasidan aniqlashtiriladi.
            ...splitLeadChildName(lead.childFullName),
            gender: null,
            birthDate: lead.childBirthDate,
            guardian: { fullName: lead.parentName, phone: lead.parentPhone, relation: "OTHER" },
          },
          {},
        );
        const updatedLead = await tx.lead.update({
          where: { id },
          data: { stage: "WON", convertedChildId: child.id },
        });
        await tx.leadActivity.create({
          data: { leadId: id, type: "STAGE_CHANGE", note: "Bolaga aylantirildi", createdByUserId: user.id },
        });
        return { lead: updatedLead, child };
      }),
    );
  }

  async stats(scope: TenantScope) {
    const where: Prisma.LeadWhereInput = { organizationId: scope.organizationId, branchId: scope.branchId ?? undefined };
    const grouped = await this.prisma.lead.groupBy({ by: ["stage"], where, _count: true });
    const byStage: Record<string, number> = { NEW: 0, TRIAL_DAY_SCHEDULED: 0, CONTRACT: 0, WON: 0, LOST: 0 };
    for (const row of grouped) {
      byStage[row.stage] = row._count;
    }
    return { byStage };
  }

  countActive(scope: TenantScope) {
    return this.prisma.lead.count({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? undefined,
        stage: { notIn: ["WON", "LOST"] },
      },
    });
  }
}
