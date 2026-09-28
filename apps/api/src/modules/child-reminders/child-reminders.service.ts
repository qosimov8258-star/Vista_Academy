import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { assertNotAssistant, assertTeacherOwnsChild, resolveTeacherGroupIds } from "../iam/teacher-scope";
import { CreateReminderDto } from "./dto/create-reminder.dto";
import { SetAllergiesDto } from "./dto/set-allergies.dto";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class ChildRemindersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bir kunlik eslatmalar. Filial darajasidagi hamma (admin, oshpaz, tarbiyachi)
   * o'qiy oladi; tarbiyachi faqat o'z guruhlari bolalarinikini ko'radi.
   */
  async list(scope: TenantScope, query: { date: string; branchId?: string; childId?: string }) {
    const branchId = scope.branchId ?? query.branchId;
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    if (!DATE_RE.test(query.date ?? "")) {
      throw new BadRequestException("Sana noto'g'ri (YYYY-MM-DD)");
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, organizationId: scope.organizationId } });
    if (!branch) {
      throw new NotFoundException("Filial topilmadi");
    }
    // Oshpaz (CHEF) butun filial eslatmalarini (dori, allergiya) ko'radi —
    // resolveTeacherGroupIds unga cheklov qo'ymaydi. O'qituvchilardan faqat
    // guruhi borlar cheklanadi.
    const groupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const restrict = groupIds !== null && groupIds.length > 0;
    const rows = await this.prisma.childReminder.findMany({
      where: {
        branchId,
        date: toDateOnly(query.date),
        ...(query.childId ? { childId: query.childId } : {}),
        ...(restrict ? { child: { groupId: { in: groupIds } } } : {}),
      },
      include: { child: { select: { id: true, fullName: true, group: { select: { name: true } } } } },
      orderBy: [{ time: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      childId: r.childId,
      childName: r.child.fullName,
      groupName: r.child.group?.name ?? null,
      date: query.date,
      time: r.time,
      text: r.text,
      authorName: r.authorName,
      doneAt: r.doneAt,
      doneByName: r.doneByName,
    }));
  }

  async create(scope: TenantScope, authorName: string, dto: CreateReminderDto) {
    const branchId = requireTeachingScope(scope);
    await assertNotAssistant(this.prisma, scope);
    if (!DATE_RE.test(dto.date.slice(0, 10))) {
      throw new BadRequestException("Sana noto'g'ri (YYYY-MM-DD)");
    }
    const child = await this.requireOwnChild(scope, branchId, dto.childId);
    const row = await this.prisma.childReminder.create({
      data: {
        branchId,
        childId: child.id,
        date: toDateOnly(dto.date.slice(0, 10)),
        time: dto.time ?? null,
        text: dto.text.trim(),
        authorName,
      },
    });
    return { id: row.id };
  }

  /** Eslatmani bajarildi deb belgilash yoki belgini qaytarish (masalan "dori berildi"). */
  async setDone(scope: TenantScope, actorName: string, id: string, done: boolean) {
    const branchId = requireTeachingScope(scope);
    const row = await this.prisma.childReminder.findFirst({ where: { id, branchId }, include: { child: { select: { groupId: true } } } });
    if (!row) {
      throw new NotFoundException("Eslatma topilmadi");
    }
    await assertTeacherOwnsChild(this.prisma, scope, row.child);
    await this.prisma.childReminder.update({
      where: { id },
      data: done ? { doneAt: new Date(), doneByName: actorName } : { doneAt: null, doneByName: null },
    });
    return { success: true };
  }

  async remove(scope: TenantScope, id: string) {
    const branchId = requireTeachingScope(scope);
    await assertNotAssistant(this.prisma, scope);
    const row = await this.prisma.childReminder.findFirst({ where: { id, branchId }, include: { child: { select: { groupId: true } } } });
    if (!row) {
      throw new NotFoundException("Eslatma topilmadi");
    }
    await assertTeacherOwnsChild(this.prisma, scope, row.child);
    await this.prisma.childReminder.delete({ where: { id } });
    return { success: true };
  }

  async setAllergies(scope: TenantScope, childId: string, dto: SetAllergiesDto) {
    const branchId = requireTeachingScope(scope);
    await assertNotAssistant(this.prisma, scope);
    const child = await this.requireOwnChild(scope, branchId, childId);
    const allergies = dto.allergies.trim() || null;
    await this.prisma.healthProfile.upsert({
      where: { childId: child.id },
      create: { childId: child.id, organizationId: child.organizationId, branchId, allergies },
      update: { allergies },
    });
    return { allergies };
  }

  private async requireOwnChild(scope: TenantScope, branchId: string, childId: string) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (child.branchId !== branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    await assertTeacherOwnsChild(this.prisma, scope, child);
    return child;
  }
}
