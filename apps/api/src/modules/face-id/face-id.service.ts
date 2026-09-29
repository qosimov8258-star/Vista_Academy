import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { encryptSecret } from "../../common/crypto/reversible-secret";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../iam/tenant-auth.types";
import { AuditLogService } from "../audit-log/audit-log.service";
import { generateAgentToken, hashAgentToken } from "./agent/agent-token";
import { FaceIdCommandsService } from "./face-id-commands.service";
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

/**
 * Qurilma javobga shu ko'rinishda chiqadi: parol va token hash'i HECH
 * QACHON qaytarilmaydi — faqat "bor/yo'q" belgisi.
 */
const deviceSelect = {
  id: true,
  organizationId: true,
  branchId: true,
  name: true,
  model: true,
  serialNumber: true,
  ipAddress: true,
  port: true,
  username: true,
  location: true,
  status: true,
  notes: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  passwordEncrypted: true,
  agentTokenHash: true,
  _count: { select: { commands: { where: { status: { in: ["PENDING", "SENT"] } } } } },
} satisfies Prisma.FaceIdDeviceSelect;

type DeviceRow = Prisma.FaceIdDeviceGetPayload<{ select: typeof deviceSelect }>;

function toPublicDevice(row: DeviceRow) {
  const { passwordEncrypted, agentTokenHash, _count, ...rest } = row;
  return { ...rest, hasPassword: !!passwordEncrypted, hasAgentToken: !!agentTokenHash, queuedCommands: _count.commands };
}

/** Parol maydoni: berilmagan — o'zgarmaydi, bo'sh qator — o'chiriladi. */
function passwordData(password: string | undefined) {
  if (password === undefined) return undefined;
  return password === "" ? null : encryptSecret(password, "DEVICE_SECRET_KEY");
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

@Injectable()
export class FaceIdService {
  private readonly logger = new Logger(FaceIdService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: FaceIdCommandsService,
    private readonly auditLog: AuditLogService,
  ) {}

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

  async findDevices(scope: TenantScope, query: DeviceQueryDto) {
    const rows = await this.prisma.faceIdDevice.findMany({
      where: {
        organizationId: scope.organizationId,
        branchId: scope.branchId ?? query.branchId,
      },
      select: deviceSelect,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toPublicDevice);
  }

  /**
   * Qurilma yaratiladi va unga agent tokeni beriladi. Token javobda FAQAT
   * shu bir marta keladi — bazada sha256 hash'i saqlanadi.
   */
  async createDevice(caller: TenantAuthenticatedUser, dto: CreateDeviceDto) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const agentToken = generateAgentToken();
    try {
      const row = await this.prisma.faceIdDevice.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          name: dto.name.trim(),
          model: dto.model?.trim() || undefined,
          serialNumber: dto.serialNumber?.trim() || null,
          ipAddress: dto.ipAddress?.trim() || null,
          port: dto.port,
          username: dto.username?.trim() || null,
          passwordEncrypted: passwordData(dto.password),
          agentTokenHash: hashAgentToken(agentToken),
          location: dto.location?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
        select: deviceSelect,
      });
      await this.auditLog.logFromUser(caller, {
        action: "faceId.device.create",
        entityType: "FaceIdDevice",
        entityId: row.id,
        branchId,
        summary: `"${row.name}" Face ID qurilmasi qo'shildi`,
      });
      return { device: toPublicDevice(row), agentToken };
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException("Bu seriya raqamli qurilma allaqachon qo'shilgan");
      throw err;
    }
  }

  async updateDevice(scope: TenantScope, id: string, dto: UpdateDeviceDto) {
    const device = await this.requireWritableDevice(scope, id);
    try {
      const row = await this.prisma.faceIdDevice.update({
        where: { id: device.id },
        data: {
          name: dto.name?.trim(),
          model: dto.model?.trim(),
          serialNumber: dto.serialNumber !== undefined ? dto.serialNumber.trim() || null : undefined,
          ipAddress: dto.ipAddress !== undefined ? dto.ipAddress.trim() || null : undefined,
          port: dto.port,
          username: dto.username !== undefined ? dto.username.trim() || null : undefined,
          passwordEncrypted: passwordData(dto.password),
          location: dto.location !== undefined ? dto.location.trim() || null : undefined,
          notes: dto.notes !== undefined ? dto.notes.trim() || null : undefined,
          status: dto.status,
        },
        select: deviceSelect,
      });
      return toPublicDevice(row);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException("Bu seriya raqamli qurilma allaqachon qo'shilgan");
      throw err;
    }
  }

  /** Yangi agent tokeni — eskisi darhol bekor bo'ladi (masalan token sizib chiqsa). */
  async regenerateAgentToken(caller: TenantAuthenticatedUser, id: string) {
    const device = await this.requireWritableDevice(toTenantScope(caller), id);
    const agentToken = generateAgentToken();
    const row = await this.prisma.faceIdDevice.update({
      where: { id: device.id },
      data: { agentTokenHash: hashAgentToken(agentToken) },
      select: { id: true, name: true },
    });
    await this.auditLog.logFromUser(caller, {
      action: "faceId.device.token",
      entityType: "FaceIdDevice",
      entityId: row.id,
      branchId: device.branchId,
      summary: `"${row.name}" qurilmasi uchun yangi agent tokeni yaratildi`,
    });
    return { agentToken };
  }

  /** "Qurilmaga to'liq sinxronlash" — filialdagi barcha faol xodimlar navbatga. */
  async syncDevice(caller: TenantAuthenticatedUser, id: string) {
    const device = await this.requireWritableDevice(toTenantScope(caller), id);
    const full = await this.prisma.faceIdDevice.findUniqueOrThrow({ where: { id: device.id }, select: { status: true, name: true } });
    if (full.status !== "ACTIVE") {
      throw new BadRequestException("Faqat faol qurilmani sinxronlash mumkin");
    }
    const result = await this.commands.enqueueFullSync(device);
    await this.auditLog.logFromUser(caller, {
      action: "faceId.device.sync",
      entityType: "FaceIdDevice",
      entityId: device.id,
      branchId: device.branchId,
      summary: `"${full.name}" qurilmasiga ${result.employees} xodim sinxronlashga qo'yildi`,
    });
    return result;
  }

  /** Qurilmaning so'nggi buyruqlari — nima ketdi, nima xato berdi. */
  async deviceCommands(scope: TenantScope, id: string) {
    const device = await this.prisma.faceIdDevice.findFirst({
      where: { id, organizationId: scope.organizationId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
      select: { id: true },
    });
    if (!device) {
      throw new NotFoundException("Qurilma topilmadi");
    }
    return this.prisma.faceIdCommand.findMany({
      where: { deviceId: device.id },
      orderBy: { seq: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        employeeNo: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        completedAt: true,
        employee: { select: { id: true, fullName: true } },
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
