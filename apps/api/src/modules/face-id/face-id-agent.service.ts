import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { decryptSecret } from "../../common/crypto/reversible-secret";
import type { AgentDevice } from "./agent/agent-token.guard";
import type { AgentEventDto } from "./dto/agent-events.dto";
import { computeDailyAttendance, lateGraceMinutes, localDateKey, utcWindowAround } from "./face-id-attendance";

/** Sana ustuni (`@db.Date`) uchun — xodimlar davomatidagi bilan bir xil. */
function toDateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/**
 * Agent tomoni: qurilma sozlamalari va voqealarni qabul qilish.
 * Voqealar idempotent saqlanadi (`@@unique([deviceId, serialNo, eventTime])`),
 * keyin tegishli xodim-kunlar uchun davomat qayta hisoblanadi.
 */
@Injectable()
export class FaceIdAgentService {
  private readonly logger = new Logger(FaceIdAgentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Agent qurilmaga ulanishi uchun kerak bo'lgan hamma narsa. Parol shu
   * yerda ochiladi va faqat HTTPS orqali agentga ketadi — logga yozilmaydi.
   */
  async config(device: AgentDevice) {
    const row = await this.prisma.faceIdDevice.findUniqueOrThrow({
      where: { id: device.id },
      select: {
        id: true,
        name: true,
        model: true,
        serialNumber: true,
        ipAddress: true,
        port: true,
        username: true,
        passwordEncrypted: true,
        status: true,
        branch: { select: { timezone: true } },
      },
    });
    await this.touch(device.id);
    return {
      device: {
        id: row.id,
        name: row.name,
        model: row.model,
        serialNumber: row.serialNumber,
        ip: row.ipAddress,
        port: row.port,
        username: row.username,
        password: row.passwordEncrypted ? decryptSecret(row.passwordEncrypted, "DEVICE_SECRET_KEY") : null,
        status: row.status,
      },
      timezone: row.branch.timezone,
      serverTime: new Date().toISOString(),
    };
  }

  /** Agent tirikligini belgilash ("oxirgi aloqa"). */
  touch(deviceId: string) {
    return this.prisma.faceIdDevice.update({ where: { id: deviceId }, data: { lastSeenAt: new Date() }, select: { id: true } });
  }

  async ingestEvents(device: AgentDevice, events: AgentEventDto[]) {
    await this.touch(device.id);
    if (events.length === 0) {
      return { received: 0, inserted: 0, attendanceUpdated: 0 };
    }

    // Bitta paket ichidagi takrorlar ham olib tashlanadi
    const unique = new Map<string, AgentEventDto & { time: Date }>();
    for (const event of events) {
      const time = new Date(event.eventTime);
      unique.set(`${event.serialNo}|${time.toISOString()}`, { ...event, time });
    }
    const rows = [...unique.values()];

    // Xodim raqami → xodim (faqat shu tashkilot ichida)
    const numbers = [...new Set(rows.map((r) => r.employeeNo).filter((n): n is string => !!n))];
    const employees = numbers.length
      ? await this.prisma.employee.findMany({
          where: { organizationId: device.organizationId, employeeNo: { in: numbers } },
          select: { id: true, employeeNo: true, branchId: true },
        })
      : [];
    const byNo = new Map(employees.map((e) => [e.employeeNo, e]));

    const created = await this.prisma.faceIdEvent.createMany({
      data: rows.map((r) => ({
        organizationId: device.organizationId,
        branchId: device.branchId,
        deviceId: device.id,
        serialNo: r.serialNo,
        employeeNo: r.employeeNo ?? null,
        employeeId: (r.employeeNo && byNo.get(r.employeeNo)?.id) || null,
        eventTime: r.time,
        major: r.major,
        minor: r.minor,
        verifyMode: r.verifyMode ?? null,
        pictureUrl: r.pictureUrl ?? null,
        raw: r.raw as Prisma.InputJsonObject,
      })),
      skipDuplicates: true,
    });

    const unknown = numbers.filter((n) => !byNo.has(n));
    if (unknown.length) {
      this.logger.warn(`Qurilma "${device.name}": noma'lum xodim raqamlari ${unknown.join(", ")}`);
    }

    // Tegishli (xodim, kun) juftliklari uchun davomat qayta hisoblanadi —
    // takror yuborilgan paket natijani o'zgartirmaydi (hisob barcha voqealardan).
    const timezone = await this.branchTimezone(device.branchId);
    const pairs = new Map<string, { employeeId: string; branchId: string; dateKey: string }>();
    for (const r of rows) {
      const employee = r.employeeNo ? byNo.get(r.employeeNo) : undefined;
      if (!employee) continue;
      const dateKey = localDateKey(r.time, timezone);
      pairs.set(`${employee.id}|${dateKey}`, { employeeId: employee.id, branchId: employee.branchId, dateKey });
    }
    let attendanceUpdated = 0;
    for (const pair of pairs.values()) {
      if (await this.recomputeAttendance(pair.employeeId, pair.branchId, pair.dateKey)) attendanceUpdated++;
    }

    return { received: events.length, inserted: created.count, attendanceUpdated };
  }

  /**
   * Bir xodimning bir kunlik davomatini voqealardan hisoblab yozadi.
   * - Kun qulflangan bo'lsa — tegilmaydi (ish haqi shu kunga bog'liq).
   * - Yozuv bo'lmasa — PRESENT (yoki kechiksa LATE) bilan yaratiladi.
   * - Yozuv bo'lsa — faqat kelish/ketish vaqtlari yangilanadi: admin qo'lda
   *   qo'ygan holat ("Kasal", "Ta'tilda" va h.k.) o'zgarmaydi.
   * Qaytaradi: yozuv yaratildi/yangilandimi.
   */
  async recomputeAttendance(employeeId: string, branchId: string, dateKey: string): Promise<boolean> {
    const branch = await this.prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { timezone: true, openTime: true },
    });
    const date = toDateOnly(dateKey);
    const lock = await this.prisma.staffAttendanceLock.findUnique({ where: { branchId_date: { branchId, date } } });
    if (lock) return false;

    const window = utcWindowAround(dateKey);
    const events = await this.prisma.faceIdEvent.findMany({
      where: { employeeId, eventTime: { gte: window.from, lt: window.to } },
      select: { eventTime: true },
    });
    const times = events.map((e) => e.eventTime).filter((t) => localDateKey(t, branch.timezone) === dateKey);
    const daily = computeDailyAttendance(times, { timeZone: branch.timezone, openTime: branch.openTime, graceMinutes: lateGraceMinutes() });
    if (!daily) return false;

    const existing = await this.prisma.employeeAttendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.employeeAttendance.update({
        where: { id: existing.id },
        data: { checkInTime: daily.checkInTime, checkOutTime: daily.checkOutTime },
      });
    } else {
      await this.prisma.employeeAttendance.create({
        data: {
          employeeId,
          branchId,
          date,
          status: daily.late ? "LATE" : "PRESENT",
          checkInTime: daily.checkInTime,
          checkOutTime: daily.checkOutTime,
          note: "Face ID",
        },
      });
    }
    return true;
  }

  private async branchTimezone(branchId: string): Promise<string> {
    const branch = await this.prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { timezone: true } });
    return branch.timezone;
  }
}
