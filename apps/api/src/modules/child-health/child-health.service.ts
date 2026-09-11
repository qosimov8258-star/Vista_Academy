import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";
import { AuditLogService } from "../audit-log/audit-log.service";
import { UpsertHealthProfileDto } from "./dto/upsert-health-profile.dto";
import { CreateVaccinationDto } from "./dto/create-vaccination.dto";
import { UpdateVaccinationDto } from "./dto/update-vaccination.dto";
import { CreateMedicationLogDto } from "./dto/create-medication-log.dto";
import { SetQuarantineDto } from "./dto/quarantine.dto";

@Injectable()
export class ChildHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async requireChild(scope: TenantScope, childId: string) {
    const child = await this.prisma.child.findFirst({ where: { id: childId, organizationId: scope.organizationId } });
    if (!child) {
      throw new NotFoundException("Bola topilmadi");
    }
    if (scope.branchId && child.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu bolaga kirish huquqingiz yo'q");
    }
    return child;
  }

  async getProfile(scope: TenantScope, childId: string) {
    await this.requireChild(scope, childId);
    return this.prisma.healthProfile.findUnique({ where: { childId } });
  }

  /**
   * Allergiyasi bor faol bolalar ro'yxati — Ovqatlanish sahifasida
   * ogohlantirish uchun. Bo'sh/matnsiz allergiya maydoni chiqarib tashlanadi.
   */
  async listAllergies(scope: TenantScope, branchId?: string) {
    const resolvedBranchId = scope.branchId ?? branchId;
    return this.prisma.healthProfile.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: resolvedBranchId,
        allergies: { not: null, notIn: [""] },
        child: { status: "ACTIVE" },
      },
      select: { allergies: true, child: { select: { id: true, fullName: true } } },
    });
  }

  async upsertProfile(scope: TenantScope, childId: string, dto: UpsertHealthProfileDto) {
    const branchId = requireOperationalScope(scope);
    const child = await this.requireChild(scope, childId);
    return this.prisma.healthProfile.upsert({
      where: { childId },
      create: {
        childId,
        organizationId: child.organizationId,
        branchId,
        bloodType: dto.bloodType,
        chronicConditions: dto.chronicConditions,
        allergies: dto.allergies,
        notes: dto.notes,
      },
      update: {
        bloodType: dto.bloodType,
        chronicConditions: dto.chronicConditions,
        allergies: dto.allergies,
        notes: dto.notes,
      },
    });
  }

  async listVaccinations(scope: TenantScope, childId: string) {
    await this.requireChild(scope, childId);
    return this.prisma.vaccination.findMany({ where: { childId }, orderBy: { scheduledDate: "desc" } });
  }

  async createVaccination(caller: TenantAuthenticatedUser, childId: string, dto: CreateVaccinationDto) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const child = await this.requireChild(scope, childId);
    const created = await this.prisma.vaccination.create({
      data: {
        childId,
        organizationId: child.organizationId,
        branchId,
        name: dto.name,
        scheduledDate: new Date(`${dto.scheduledDate}T00:00:00.000Z`),
        note: dto.note,
      },
    });
    await this.auditLog.logFromUser(caller, {
      action: "vaccination.create",
      entityType: "Vaccination",
      entityId: created.id,
      branchId,
      summary: `${child.fullName} uchun "${created.name}" vaksinatsiyasi rejalashtirildi`,
    });
    return created;
  }

  async updateVaccination(caller: TenantAuthenticatedUser, vaccinationId: string, dto: UpdateVaccinationDto) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const vaccination = await this.prisma.vaccination.findFirst({
      where: { id: vaccinationId, organizationId: scope.organizationId },
      include: { child: { select: { fullName: true } } },
    });
    if (!vaccination) {
      throw new NotFoundException("Vaksinatsiya topilmadi");
    }
    if (vaccination.branchId !== branchId) {
      throw new ForbiddenException("Bu yozuvga kirish huquqingiz yo'q");
    }
    const updated = await this.prisma.vaccination.update({
      where: { id: vaccinationId },
      data: {
        status: dto.status,
        doneDate: dto.doneDate ? new Date(`${dto.doneDate}T00:00:00.000Z`) : undefined,
        note: dto.note,
      },
    });
    await this.auditLog.logFromUser(caller, {
      action: "vaccination.update",
      entityType: "Vaccination",
      entityId: vaccinationId,
      branchId,
      summary: `${vaccination.child.fullName}ning "${vaccination.name}" vaksinatsiyasi yangilandi${dto.status ? ` (${dto.status})` : ""}`,
    });
    return updated;
  }

  async listMedicationLogs(scope: TenantScope, childId: string) {
    await this.requireChild(scope, childId);
    return this.prisma.medicationLog.findMany({ where: { childId }, orderBy: { givenAt: "desc" } });
  }

  async createMedicationLog(user: TenantAuthenticatedUser, childId: string, dto: CreateMedicationLogDto) {
    const scope = toTenantScope(user);
    const branchId = requireOperationalScope(scope);
    const child = await this.requireChild(scope, childId);
    return this.prisma.medicationLog.create({
      data: {
        childId,
        organizationId: child.organizationId,
        branchId,
        medicationName: dto.medicationName,
        dose: dto.dose,
        givenAt: new Date(dto.givenAt),
        parentAuthorized: dto.parentAuthorized,
        note: dto.note,
        givenByUserId: user.id,
      },
    });
  }

  async setQuarantine(scope: TenantScope, childId: string, dto: SetQuarantineDto) {
    requireOperationalScope(scope);
    await this.requireChild(scope, childId);
    return this.prisma.child.update({
      where: { id: childId },
      data: {
        status: "QUARANTINED",
        quarantineUntil: new Date(`${dto.until}T00:00:00.000Z`),
        quarantineReason: dto.reason,
      },
    });
  }

  async clearQuarantine(scope: TenantScope, childId: string) {
    requireOperationalScope(scope);
    await this.requireChild(scope, childId);
    return this.prisma.child.update({
      where: { id: childId },
      data: { status: "ACTIVE", quarantineUntil: null, quarantineReason: null },
    });
  }
}
