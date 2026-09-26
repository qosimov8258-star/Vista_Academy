import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { CreateDeviceDto } from "./dto/create-device.dto";
import { UpdateDeviceDto } from "./dto/update-device.dto";
import { DeviceQueryDto } from "./dto/device-query.dto";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { UpdateEnrollmentDto } from "./dto/update-enrollment.dto";
import { EnrollmentQueryDto } from "./dto/enrollment-query.dto";

/** Ro'yxatda qurilma nomi va bog'langan xodim/bola qisqacha ko'rinadi. */
const enrollmentInclude = {
  device: { select: { id: true, name: true } },
  employee: { select: { id: true, fullName: true, avatarUpdatedAt: true } },
  child: { select: { id: true, fullName: true, avatarUpdatedAt: true, gender: true } },
} satisfies Prisma.FaceEnrollmentInclude;

@Injectable()
export class FaceIdService {
  private readonly logger = new Logger(FaceIdService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Xodim yoki bola yaratilganda avtomatik chaqiriladi: shu filialda kamida
   * bitta FAOL Face ID qurilmasi bo'lsa, har biriga "PENDING" holatda yuz
   * yozuvi qo'shiladi — admin buni "Yuz ro'yxati" sahifasida qo'lda
   * qo'shmasin. Ikkinchi darajali (yordamchi) amal — xatosi xodim/bola
   * yaratilishini hech qachon bloklamasligi kerak, shuning uchun faqat
   * log qilinadi.
   */
  async autoEnrollNewPerson(
    scope: { organizationId: string; branchId: string },
    person: { personType: "EMPLOYEE"; employeeId: string } | { personType: "CHILD"; childId: string },
  ): Promise<void> {
    try {
      const devices = await this.prisma.faceIdDevice.findMany({
        where: { organizationId: scope.organizationId, branchId: scope.branchId, status: "ACTIVE" },
        select: { id: true },
      });
      if (devices.length === 0) {
        return;
      }
      await this.prisma.faceEnrollment.createMany({
        data: devices.map((device) => ({
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          deviceId: device.id,
          personType: person.personType,
          employeeId: person.personType === "EMPLOYEE" ? person.employeeId : undefined,
          childId: person.personType === "CHILD" ? person.childId : undefined,
          status: "PENDING" as const,
        })),
      });
    } catch (err) {
      this.logger.warn(`Face ID auto-enroll muvaffaqiyatsiz: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---------------------------------------------------------------------
  // Qurilmalar
  // ---------------------------------------------------------------------

  findDevices(scope: TenantScope, query: DeviceQueryDto) {
    return this.prisma.faceIdDevice.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? query.branchId,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createDevice(scope: TenantScope, dto: CreateDeviceDto) {
    const branchId = requireOperationalScope(scope);
    return this.prisma.faceIdDevice.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        name: dto.name.trim(),
        model: dto.model?.trim() || undefined,
        serialNumber: dto.serialNumber?.trim() || null,
        ipAddress: dto.ipAddress?.trim() || null,
        location: dto.location?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async updateDevice(scope: TenantScope, id: string, dto: UpdateDeviceDto) {
    const device = await this.requireWritableDevice(scope, id);
    return this.prisma.faceIdDevice.update({
      where: { id: device.id },
      data: {
        name: dto.name?.trim(),
        model: dto.model?.trim(),
        serialNumber: dto.serialNumber !== undefined ? dto.serialNumber.trim() || null : undefined,
        ipAddress: dto.ipAddress !== undefined ? dto.ipAddress.trim() || null : undefined,
        location: dto.location !== undefined ? dto.location.trim() || null : undefined,
        notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
        status: dto.status,
      },
    });
  }

  async removeDevice(scope: TenantScope, id: string) {
    const device = await this.requireWritableDevice(scope, id);
    // Bog'langan yuz yozuvlari ham o'chadi (sxemada `onDelete: Cascade`).
    await this.prisma.faceIdDevice.delete({ where: { id: device.id } });
    return { id: device.id };
  }

  /** Yozish uchun: qurilma shu tashkilot/filialda. */
  private async requireWritableDevice(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    const device = await this.prisma.faceIdDevice.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true, branchId: true },
    });
    if (!device) {
      throw new NotFoundException("Qurilma topilmadi");
    }
    return device;
  }

  // ---------------------------------------------------------------------
  // Yuz ro'yxati (enrollments)
  // ---------------------------------------------------------------------

  findEnrollments(scope: TenantScope, query: EnrollmentQueryDto) {
    return this.prisma.faceEnrollment.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? query.branchId,
        ...(query.personType ? { personType: query.personType } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: enrollmentInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async createEnrollment(scope: TenantScope, dto: CreateEnrollmentDto) {
    const branchId = requireOperationalScope(scope);

    if (dto.personType === "EMPLOYEE") {
      if (!dto.employeeId || dto.childId) {
        throw new BadRequestException("EMPLOYEE turi uchun faqat employeeId to'ldirilishi kerak");
      }
    } else if (dto.personType === "CHILD") {
      if (!dto.childId || dto.employeeId) {
        throw new BadRequestException("CHILD turi uchun faqat childId to'ldirilishi kerak");
      }
    }

    const device = await this.prisma.faceIdDevice.findFirst({
      where: { id: dto.deviceId, organizationId: scope.organizationId, branchId },
      select: { id: true },
    });
    if (!device) {
      throw new NotFoundException("Qurilma topilmadi");
    }

    if (dto.personType === "EMPLOYEE") {
      const employee = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, organizationId: scope.organizationId, branchId },
        select: { id: true },
      });
      if (!employee) {
        throw new NotFoundException("Xodim topilmadi");
      }
    } else {
      const child = await this.prisma.child.findFirst({
        where: { id: dto.childId, organizationId: scope.organizationId, branchId },
        select: { id: true },
      });
      if (!child) {
        throw new NotFoundException("Bola topilmadi");
      }
    }

    return this.prisma.faceEnrollment.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        deviceId: dto.deviceId,
        personType: dto.personType,
        employeeId: dto.personType === "EMPLOYEE" ? dto.employeeId : null,
        childId: dto.personType === "CHILD" ? dto.childId : null,
        notes: dto.notes?.trim() || null,
      },
      include: enrollmentInclude,
    });
  }

  async updateEnrollment(scope: TenantScope, id: string, dto: UpdateEnrollmentDto) {
    const branchId = requireOperationalScope(scope);
    const enrollment = await this.prisma.faceEnrollment.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
    });
    if (!enrollment) {
      throw new NotFoundException("Yozuv topilmadi");
    }

    const data: Prisma.FaceEnrollmentUpdateInput = {};
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === "REGISTERED" && !enrollment.registeredAt) {
        data.registeredAt = new Date();
      }
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes.trim() || null;
    }

    return this.prisma.faceEnrollment.update({
      where: { id: enrollment.id },
      data,
      include: enrollmentInclude,
    });
  }

  async removeEnrollment(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    const enrollment = await this.prisma.faceEnrollment.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true },
    });
    if (!enrollment) {
      throw new NotFoundException("Yozuv topilmadi");
    }
    await this.prisma.faceEnrollment.delete({ where: { id: enrollment.id } });
    return { id: enrollment.id };
  }
}
