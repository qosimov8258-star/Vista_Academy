import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, TenantScope, requireBranchScope } from "../iam/tenant-auth.types";
import { UpsertHealthProfileDto } from "./dto/upsert-health-profile.dto";
import { CreateVaccinationDto } from "./dto/create-vaccination.dto";
import { UpdateVaccinationDto } from "./dto/update-vaccination.dto";
import { CreateMedicationLogDto } from "./dto/create-medication-log.dto";
import { SetQuarantineDto } from "./dto/quarantine.dto";

@Injectable()
export class ChildHealthService {
  constructor(private readonly prisma: PrismaService) {}

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

  async upsertProfile(scope: TenantScope, childId: string, dto: UpsertHealthProfileDto) {
    const branchId = requireBranchScope(scope);
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

  async createVaccination(scope: TenantScope, childId: string, dto: CreateVaccinationDto) {
    const branchId = requireBranchScope(scope);
    const child = await this.requireChild(scope, childId);
    return this.prisma.vaccination.create({
      data: {
        childId,
        organizationId: child.organizationId,
        branchId,
        name: dto.name,
        scheduledDate: new Date(`${dto.scheduledDate}T00:00:00.000Z`),
        note: dto.note,
      },
    });
  }

  async updateVaccination(scope: TenantScope, vaccinationId: string, dto: UpdateVaccinationDto) {
    const branchId = requireBranchScope(scope);
    const vaccination = await this.prisma.vaccination.findFirst({
      where: { id: vaccinationId, organizationId: scope.organizationId },
    });
    if (!vaccination) {
      throw new NotFoundException("Vaksinatsiya topilmadi");
    }
    if (vaccination.branchId !== branchId) {
      throw new ForbiddenException("Bu yozuvga kirish huquqingiz yo'q");
    }
    return this.prisma.vaccination.update({
      where: { id: vaccinationId },
      data: {
        status: dto.status,
        doneDate: dto.doneDate ? new Date(`${dto.doneDate}T00:00:00.000Z`) : undefined,
        note: dto.note,
      },
    });
  }

  async listMedicationLogs(scope: TenantScope, childId: string) {
    await this.requireChild(scope, childId);
    return this.prisma.medicationLog.findMany({ where: { childId }, orderBy: { givenAt: "desc" } });
  }

  async createMedicationLog(user: TenantAuthenticatedUser, childId: string, dto: CreateMedicationLogDto) {
    const scope = { organizationId: user.organizationId, branchId: user.branchId };
    const branchId = requireBranchScope(scope);
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
    requireBranchScope(scope);
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
    requireBranchScope(scope);
    await this.requireChild(scope, childId);
    return this.prisma.child.update({
      where: { id: childId },
      data: { status: "ACTIVE", quarantineUntil: null, quarantineReason: null },
    });
  }
}
