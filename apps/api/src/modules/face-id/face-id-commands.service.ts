import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FaceIdCommandType, Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { R2Service } from "../storage/r2.service";
import type { AgentDevice } from "./agent/agent-token.guard";
import type { AgentCommandAckDto } from "./dto/agent-command-ack.dto";
import { childDeviceNo } from "./device-person";

/** Shu urinishdan keyin buyruq FAILED bo'ladi (qayta navbatga qaytmaydi). */
export const MAX_COMMAND_ATTEMPTS = 5;
/** Agent SENT buyruqqa shuncha vaqtda javob bermasa — buyruq qayta navbatga qaytadi. */
export const SENT_TIMEOUT_MS = 5 * 60_000;

/** Bekor qilingan buyruq sababi (terminaldan o'chirilayotgan odamni qo'shish ma'nosiz). */
const CANCELLED_BY_DELETE = "Terminaldan o'chirildi — buyruq bekor qilindi";

/** Agentga beriladigan buyruq ko'rinishi. */
export interface AgentCommand {
  id: string;
  type: FaceIdCommandType;
  employeeNo: string;
  payload: Prisma.JsonValue;
  attempts: number;
}

/** Terminaldagi foydalanuvchi: xodim yoki bola (bittasi to'ldiriladi). */
type EnqueueTarget = {
  organizationId: string;
  branchId: string;
  employeeId: string | null;
  childId: string | null;
  employeeNo: string;
};

/**
 * Qurilma buyruqlari navbati (ERP → agent → qurilma).
 *
 * - Xodim/bola yaratilsa → ADD_OR_UPDATE_USER (+ surati bo'lsa SET_FACE)
 * - Surat qo'yilsa/almashsa → SET_FACE
 * - Xodim o'chirilsa, bola nofaol qilinsa → DELETE_USER (navbatdagi
 *   qo'shish buyruqlari bekor)
 *
 * Bola terminalda "C" prefiksli raqam bilan turadi (C14732).
 * Buyruq faqat o'sha filialdagi FAOL qurilmalarga yoziladi. Bir xil
 * (qurilma, xodim, tur) uchun navbatda turgan buyruq takrorlanmaydi —
 * payload'i yangilanadi. Yaratish xodim amalini hech qachon to'xtatmasligi
 * kerak, shuning uchun `enqueue*` xatolari faqat log qilinadi.
 */
@Injectable()
export class FaceIdCommandsService {
  private readonly logger = new Logger(FaceIdCommandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  // ---------------------------------------------------------------------
  // Navbatga qo'yish (xodimlar va bolalar servislaridan chaqiriladi)
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
        await this.upsertPersonCommands(deviceId, this.employeeTarget(employee), employee.fullName, employee.avatarUpdatedAt);
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
        await this.upsertPending(deviceId, this.employeeTarget(employee), "SET_FACE", {
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
    await this.safely("xodimni o'chirish", () => this.enqueueDeleteFor({ ...person, employeeId: null, childId: null }));
  }

  // --- Bolalar ----------------------------------------------------------

  /**
   * Bola qo'shildi yoki ma'lumoti o'zgardi. Faol bo'lsa — terminalga
   * (surati bo'lsa yuzi bilan); nofaol bo'lsa — terminaldan o'chiriladi
   * (bog'chadan ketgan bola turniketdan o'tmasin).
   */
  async enqueueChildSync(childId: string): Promise<void> {
    await this.safely("bolani sinxronlash", async () => {
      const child = await this.prisma.child.findUnique({
        where: { id: childId },
        select: { id: true, organizationId: true, branchId: true, publicId: true, fullName: true, status: true, avatarUpdatedAt: true },
      });
      if (!child) return;
      const target = this.childTarget(child);
      if (child.status === "INACTIVE") {
        await this.enqueueDeleteFor(target);
        return;
      }
      for (const deviceId of await this.activeDeviceIds(child.branchId)) {
        await this.upsertPersonCommands(deviceId, target, child.fullName, child.avatarUpdatedAt);
      }
    });
  }

  /** Bola surati qo'yildi yoki almashtirildi. */
  async enqueueChildFace(childId: string): Promise<void> {
    await this.safely("bola yuzini yuborish", async () => {
      const child = await this.prisma.child.findUnique({
        where: { id: childId },
        select: { id: true, organizationId: true, branchId: true, publicId: true, status: true, avatarUpdatedAt: true },
      });
      if (!child || child.status === "INACTIVE" || !child.avatarUpdatedAt) return;
      const target = this.childTarget(child);
      for (const deviceId of await this.activeDeviceIds(child.branchId)) {
        await this.upsertPending(deviceId, target, "SET_FACE", { employeeNo: target.employeeNo, avatarUpdatedAt: child.avatarUpdatedAt.toISOString() });
      }
    });
  }

  /**
   * "Qurilmaga to'liq sinxronlash": filialdagi barcha faol xodim va bolalar uchun
   * buyruqlar. Qurilma almashtirilganda yoki tozalanganda ishlatiladi.
   * Qaytaradi: nechta xodim va bola navbatga qo'yildi.
   */
  async enqueueFullSync(device: { id: string; branchId: string }): Promise<{ employees: number; children: number }> {
    const employees = await this.prisma.employee.findMany({
      where: { branchId: device.branchId, isActive: true },
      select: { id: true, organizationId: true, branchId: true, employeeNo: true, fullName: true, avatarUpdatedAt: true },
      orderBy: { employeeNo: "asc" },
    });
    for (const employee of employees) {
      await this.upsertPersonCommands(device.id, this.employeeTarget(employee), employee.fullName, employee.avatarUpdatedAt);
    }
    // Karantindagi bola ham terminalda qoladi — karantin tugagach qayta qo'shish shart bo'lmasin
    const children = await this.prisma.child.findMany({
      where: { branchId: device.branchId, status: { not: "INACTIVE" } },
      select: { id: true, organizationId: true, branchId: true, publicId: true, fullName: true, avatarUpdatedAt: true },
      orderBy: { publicId: "asc" },
    });
    for (const child of children) {
      await this.upsertPersonCommands(device.id, this.childTarget(child), child.fullName, child.avatarUpdatedAt);
    }
    return { employees: employees.length, children: children.length };
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
      select: { id: true, type: true, status: true, attempts: true, employeeId: true, childId: true },
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
      await this.syncEnrollment(device.id, command, command.type, "DONE", null, now);
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
      await this.syncEnrollment(device.id, command, command.type, "FAILED", error, now);
    }
    return { id: command.id, status };
  }

  /** SET_FACE uchun xodim yoki bolaning joriy surati (agent kichraytirib qurilmaga yuboradi). */
  async faceImage(device: AgentDevice, commandId: string) {
    const command = await this.prisma.faceIdCommand.findFirst({
      where: { id: commandId, deviceId: device.id, type: "SET_FACE" },
      select: { employeeId: true, childId: true },
    });
    if (!command?.employeeId && !command?.childId) {
      throw new NotFoundException("Buyruq yoki uning egasi topilmadi");
    }
    const person = command.employeeId
      ? await this.prisma.employee.findUnique({
          where: { id: command.employeeId },
          select: { avatar: true, avatarKey: true, avatarMimeType: true },
        })
      : await this.prisma.child.findUnique({
          where: { id: command.childId! },
          select: { avatar: true, avatarKey: true, avatarMimeType: true },
        });
    if (!person?.avatar && !person?.avatarKey) {
      throw new NotFoundException(command.employeeId ? "Xodimda surat yo'q" : "Bolada surat yo'q");
    }
    // Terminal firmware — redirect emas, bayt server orqali o'qiladi (brauzer endpointlaridan farqli).
    if (person.avatarKey) {
      const { buffer, contentType } = await this.r2.getObjectBuffer(person.avatarKey);
      return { data: buffer, mimeType: contentType ?? person.avatarMimeType ?? "image/jpeg" };
    }
    return { data: Buffer.from(person.avatar!), mimeType: person.avatarMimeType ?? "image/jpeg" };
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

  private employeeTarget(employee: { id: string; organizationId: string; branchId: string; employeeNo: string }): EnqueueTarget {
    return { organizationId: employee.organizationId, branchId: employee.branchId, employeeId: employee.id, childId: null, employeeNo: employee.employeeNo };
  }

  private childTarget(child: { id: string; organizationId: string; branchId: string; publicId: number }): EnqueueTarget {
    return { organizationId: child.organizationId, branchId: child.branchId, employeeId: null, childId: child.id, employeeNo: childDeviceNo(child.publicId) };
  }

  /** Terminalga foydalanuvchi + (surati bo'lsa) yuz, "Yuz ro'yxati"da yozuv. */
  private async upsertPersonCommands(deviceId: string, target: EnqueueTarget, name: string, avatarUpdatedAt: Date | null) {
    await this.upsertPending(deviceId, target, "ADD_OR_UPDATE_USER", { employeeNo: target.employeeNo, name });
    if (avatarUpdatedAt) {
      await this.upsertPending(deviceId, target, "SET_FACE", { employeeNo: target.employeeNo, avatarUpdatedAt: avatarUpdatedAt.toISOString() });
    }
    await this.ensureEnrollment(deviceId, target);
  }

  /** Navbatdagi qo'shish/yuz buyruqlarini bekor qilib, DELETE_USER qo'yadi. */
  private async enqueueDeleteFor(target: EnqueueTarget) {
    const devices = await this.activeDeviceIds(target.branchId);
    if (devices.length === 0) return;
    await this.prisma.faceIdCommand.updateMany({
      where: { deviceId: { in: devices }, employeeNo: target.employeeNo, status: { in: ["PENDING", "SENT"] }, type: { not: "DELETE_USER" } },
      data: { status: "FAILED", lastError: CANCELLED_BY_DELETE, completedAt: new Date() },
    });
    for (const deviceId of devices) {
      await this.upsertPending(deviceId, target, "DELETE_USER", { employeeNo: target.employeeNo });
    }
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
        childId: target.childId,
        employeeNo: target.employeeNo,
        type,
        payload,
      },
    });
  }

  /** "Yuz ro'yxati" sahifasida xodim shu qurilma bo'yicha ko'rinib tursin. */
  private async ensureEnrollment(deviceId: string, target: EnqueueTarget) {
    const owner = target.employeeId ? { employeeId: target.employeeId } : target.childId ? { childId: target.childId } : null;
    if (!owner) return;
    const existing = await this.prisma.faceEnrollment.findFirst({ where: { deviceId, ...owner }, select: { id: true } });
    if (existing) return;
    await this.prisma.faceEnrollment.create({
      data: {
        organizationId: target.organizationId,
        branchId: target.branchId,
        deviceId,
        personType: target.employeeId ? "EMPLOYEE" : "CHILD",
        ...owner,
        status: "PENDING",
      },
    });
  }

  /** Buyruq natijasini "Yuz ro'yxati"dagi holatga ko'chiradi. */
  private async syncEnrollment(
    deviceId: string,
    person: { employeeId: string | null; childId: string | null },
    type: FaceIdCommandType,
    outcome: "DONE" | "FAILED",
    error: string | null,
    now: Date,
  ) {
    const owner = person.employeeId ? { employeeId: person.employeeId } : person.childId ? { childId: person.childId } : null;
    if (!owner) return;
    const where = { deviceId, ...owner };
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
