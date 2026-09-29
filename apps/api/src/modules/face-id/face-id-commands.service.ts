import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FaceIdCommandType, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { AgentDevice } from "./agent/agent-token.guard";
import type { AgentCommandAckDto } from "./dto/agent-command-ack.dto";

/** Shu urinishdan keyin buyruq FAILED bo'ladi (qayta navbatga qaytmaydi). */
export const MAX_COMMAND_ATTEMPTS = 5;
/** Agent SENT buyruqqa shuncha vaqtda javob bermasa — buyruq qayta navbatga qaytadi. */
export const SENT_TIMEOUT_MS = 5 * 60_000;

/** Bekor qilingan buyruq sababi (xodim o'chirilgach, uni qo'shish ma'nosiz). */
const CANCELLED_BY_DELETE = "Xodim o'chirildi — buyruq bekor qilindi";

/** Agentga beriladigan buyruq ko'rinishi. */
export interface AgentCommand {
  id: string;
  type: FaceIdCommandType;
  employeeNo: string;
  payload: Prisma.JsonValue;
  attempts: number;
}

type EnqueueTarget = { organizationId: string; branchId: string; employeeId: string | null; employeeNo: string };

/**
 * Qurilma buyruqlari navbati (ERP → agent → qurilma).
 *
 * - Xodim yaratilsa → ADD_OR_UPDATE_USER (+ surati bo'lsa SET_FACE)
 * - Surat qo'yilsa/almashsa → SET_FACE
 * - Xodim o'chirilsa → DELETE_USER (navbatdagi qo'shish buyruqlari bekor)
 *
 * Buyruq faqat xodim filialidagi FAOL qurilmalarga yoziladi. Bir xil
 * (qurilma, xodim, tur) uchun navbatda turgan buyruq takrorlanmaydi —
 * payload'i yangilanadi. Yaratish xodim amalini hech qachon to'xtatmasligi
 * kerak, shuning uchun `enqueue*` xatolari faqat log qilinadi.
 */
@Injectable()
export class FaceIdCommandsService {
  private readonly logger = new Logger(FaceIdCommandsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Navbatga qo'yish (xodimlar servisidan chaqiriladi)
  // ---------------------------------------------------------------------

  /** Xodim yaratildi yoki ma'lumoti o'zgardi: qurilmada foydalanuvchi + (bo'lsa) yuz. */
  async enqueueEmployeeSync(employeeId: string): Promise<void> {
    await this.safely("xodimni sinxronlash", async () => {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, organizationId: true, branchId: true, employeeNo: true, fullName: true, isActive: true, avatarUpdatedAt: true },
      });
      if (!employee || !employee.isActive) return;
      const devices = await this.activeDeviceIds(employee.branchId);
      for (const deviceId of devices) {
        await this.upsertEmployeeCommands(deviceId, employee);
      }
    });
  }

  /** Xodim surati qo'yildi yoki almashtirildi. */
  async enqueueFace(employeeId: string): Promise<void> {
    await this.safely("yuzni yuborish", async () => {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, organizationId: true, branchId: true, employeeNo: true, isActive: true, avatarUpdatedAt: true },
      });
      if (!employee || !employee.isActive || !employee.avatarUpdatedAt) return;
      for (const deviceId of await this.activeDeviceIds(employee.branchId)) {
        await this.upsertPending(deviceId, this.target(employee), "SET_FACE", {
          employeeNo: employee.employeeNo,
          avatarUpdatedAt: employee.avatarUpdatedAt.toISOString(),
        });
      }
    });
  }

  /**
   * Xodim o'chirildi. Xodim yozuvi endi yo'q, shuning uchun raqami va
   * filiali oldindan olinib beriladi. Navbatdagi qo'shish/yuz buyruqlari
   * bekor qilinadi — aks holda agent o'chirilgan xodimni qayta qo'shardi.
   */
  async enqueueDelete(person: { organizationId: string; branchId: string; employeeNo: string }): Promise<void> {
    await this.safely("xodimni o'chirish", async () => {
      const devices = await this.activeDeviceIds(person.branchId);
      if (devices.length === 0) return;
      await this.prisma.faceIdCommand.updateMany({
        where: { deviceId: { in: devices }, employeeNo: person.employeeNo, status: { in: ["PENDING", "SENT"] }, type: { not: "DELETE_USER" } },
        data: { status: "FAILED", lastError: CANCELLED_BY_DELETE, completedAt: new Date() },
      });
      for (const deviceId of devices) {
        await this.upsertPending(deviceId, { ...person, employeeId: null }, "DELETE_USER", { employeeNo: person.employeeNo });
      }
    });
  }

  /**
   * "Qurilmaga to'liq sinxronlash": filialdagi barcha faol xodimlar uchun
   * buyruqlar. Qurilma almashtirilganda yoki tozalanganda ishlatiladi.
   * Qaytaradi: nechta xodim navbatga qo'yildi.
   */
  async enqueueFullSync(device: { id: string; branchId: string }): Promise<{ employees: number }> {
    const employees = await this.prisma.employee.findMany({
      where: { branchId: device.branchId, isActive: true },
      select: { id: true, organizationId: true, branchId: true, employeeNo: true, fullName: true, avatarUpdatedAt: true },
      orderBy: { employeeNo: "asc" },
    });
    for (const employee of employees) {
      await this.upsertEmployeeCommands(device.id, employee);
    }
    return { employees: employees.length };
  }

  // ---------------------------------------------------------------------
  // Agent tomoni
  // ---------------------------------------------------------------------

  /**
   * Agentga navbatdagi buyruqlarni beradi va ularni SENT deb belgilaydi.
   * Avval javobsiz qolib ketgan (SENT_TIMEOUT_MS dan eski) buyruqlar qayta
   * navbatga qaytariladi — agent o'chib qolgan bo'lsa ham buyruq yo'qolmaydi.
   */
  async dispatch(device: AgentDevice, limit: number, now = new Date()): Promise<AgentCommand[]> {
    await this.prisma.faceIdCommand.updateMany({
      where: { deviceId: device.id, status: "SENT", sentAt: { lt: new Date(now.getTime() - SENT_TIMEOUT_MS) } },
      data: { status: "PENDING", lastError: "Agent javob bermadi — qayta navbatga qo'yildi" },
    });
    const pending = await this.prisma.faceIdCommand.findMany({
      where: { deviceId: device.id, status: "PENDING" },
      orderBy: { seq: "asc" },
      take: limit,
      select: { id: true },
    });
    if (pending.length === 0) return [];
    const ids = pending.map((c) => c.id);
    // Faqat hali PENDING turganlari olinadi — parallel so'rov bo'lsa ikki marta berilmasin
    await this.prisma.faceIdCommand.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status: "SENT", sentAt: now, attempts: { increment: 1 } },
    });
    const sent = await this.prisma.faceIdCommand.findMany({
      where: { id: { in: ids }, status: "SENT", sentAt: now },
      orderBy: { seq: "asc" },
      select: { id: true, type: true, employeeNo: true, payload: true, attempts: true },
    });
    return sent;
  }

  /**
   * Agent natijasi. Muvaffaqiyat → DONE. Xato → urinishlar tugamagan bo'lsa
   * qayta PENDING, tugagan bo'lsa FAILED. Takror ack (masalan tarmoq uzilib
   * agent qayta yuborsa) holatni buzmaydi — joriy holat qaytariladi.
   */
  async ack(device: AgentDevice, commandId: string, dto: AgentCommandAckDto, now = new Date()) {
    const command = await this.prisma.faceIdCommand.findFirst({
      where: { id: commandId, deviceId: device.id },
      select: { id: true, type: true, status: true, attempts: true, employeeId: true },
    });
    if (!command) {
      throw new NotFoundException("Buyruq topilmadi");
    }
    if (command.status !== "SENT") {
      return { id: command.id, status: command.status };
    }

    if (dto.success) {
      await this.prisma.faceIdCommand.update({
        where: { id: command.id },
        data: { status: "DONE", completedAt: now, lastError: null },
      });
      await this.syncEnrollment(device.id, command.employeeId, command.type, "DONE", null, now);
      return { id: command.id, status: "DONE" as const };
    }

    const error = (dto.error ?? "Noma'lum xato").slice(0, 2000);
    const finalFailure = command.attempts >= MAX_COMMAND_ATTEMPTS;
    const status = finalFailure ? ("FAILED" as const) : ("PENDING" as const);
    await this.prisma.faceIdCommand.update({
      where: { id: command.id },
      data: { status, lastError: error, completedAt: finalFailure ? now : null },
    });
    if (finalFailure) {
      await this.syncEnrollment(device.id, command.employeeId, command.type, "FAILED", error, now);
    }
    return { id: command.id, status };
  }

  /** SET_FACE uchun xodimning joriy surati (agent kichraytirib qurilmaga yuboradi). */
  async faceImage(device: AgentDevice, commandId: string) {
    const command = await this.prisma.faceIdCommand.findFirst({
      where: { id: commandId, deviceId: device.id, type: "SET_FACE" },
      select: { employeeId: true },
    });
    if (!command?.employeeId) {
      throw new NotFoundException("Buyruq yoki xodim topilmadi");
    }
    const employee = await this.prisma.employee.findUnique({
      where: { id: command.employeeId },
      select: { avatar: true, avatarMimeType: true },
    });
    if (!employee?.avatar) {
      throw new NotFoundException("Xodimda surat yo'q");
    }
    return { data: Buffer.from(employee.avatar), mimeType: employee.avatarMimeType ?? "image/jpeg" };
  }

  // ---------------------------------------------------------------------
  // Ichki yordamchilar
  // ---------------------------------------------------------------------

  private async activeDeviceIds(branchId: string): Promise<string[]> {
    const devices = await this.prisma.faceIdDevice.findMany({
      where: { branchId, status: "ACTIVE" },
      select: { id: true },
    });
    return devices.map((d) => d.id);
  }

  private target(employee: { id: string; organizationId: string; branchId: string; employeeNo: string }): EnqueueTarget {
    return { organizationId: employee.organizationId, branchId: employee.branchId, employeeId: employee.id, employeeNo: employee.employeeNo };
  }

  private async upsertEmployeeCommands(
    deviceId: string,
    employee: { id: string; organizationId: string; branchId: string; employeeNo: string; fullName: string; avatarUpdatedAt: Date | null },
  ) {
    const target = this.target(employee);
    await this.upsertPending(deviceId, target, "ADD_OR_UPDATE_USER", { employeeNo: employee.employeeNo, name: employee.fullName });
    if (employee.avatarUpdatedAt) {
      await this.upsertPending(deviceId, target, "SET_FACE", {
        employeeNo: employee.employeeNo,
        avatarUpdatedAt: employee.avatarUpdatedAt.toISOString(),
      });
    }
    await this.ensureEnrollment(deviceId, target);
  }

  /** Navbatda (PENDING) xuddi shunday buyruq bo'lsa — payload yangilanadi, aks holda yangisi. */
  private async upsertPending(deviceId: string, target: EnqueueTarget, type: FaceIdCommandType, payload: Prisma.InputJsonObject) {
    const existing = await this.prisma.faceIdCommand.findFirst({
      where: { deviceId, employeeNo: target.employeeNo, type, status: "PENDING" },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.faceIdCommand.update({ where: { id: existing.id }, data: { payload } });
      return;
    }
    await this.prisma.faceIdCommand.create({
      data: {
        organizationId: target.organizationId,
        branchId: target.branchId,
        deviceId,
        employeeId: target.employeeId,
        employeeNo: target.employeeNo,
        type,
        payload,
      },
    });
  }

  /** "Yuz ro'yxati" sahifasida xodim shu qurilma bo'yicha ko'rinib tursin. */
  private async ensureEnrollment(deviceId: string, target: EnqueueTarget) {
    if (!target.employeeId) return;
    const existing = await this.prisma.faceEnrollment.findFirst({
      where: { deviceId, employeeId: target.employeeId },
      select: { id: true },
    });
    if (existing) return;
    await this.prisma.faceEnrollment.create({
      data: {
        organizationId: target.organizationId,
        branchId: target.branchId,
        deviceId,
        personType: "EMPLOYEE",
        employeeId: target.employeeId,
        status: "PENDING",
      },
    });
  }

  /** Buyruq natijasini "Yuz ro'yxati"dagi holatga ko'chiradi. */
  private async syncEnrollment(
    deviceId: string,
    employeeId: string | null,
    type: FaceIdCommandType,
    outcome: "DONE" | "FAILED",
    error: string | null,
    now: Date,
  ) {
    if (!employeeId) return;
    const where = { deviceId, employeeId };
    if (outcome === "FAILED") {
      await this.prisma.faceEnrollment.updateMany({ where, data: { status: "FAILED", notes: error } });
      return;
    }
    if (type === "SET_FACE") {
      await this.prisma.faceEnrollment.updateMany({ where, data: { status: "REGISTERED", registeredAt: now, notes: null } });
    } else if (type === "DELETE_USER") {
      await this.prisma.faceEnrollment.updateMany({ where, data: { status: "REMOVED" } });
    }
  }

  private async safely(what: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.logger.warn(`Face ID buyrug'i (${what}) yaratilmadi: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
