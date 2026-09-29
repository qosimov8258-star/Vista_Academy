import { beforeEach, describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { FaceIdAgentService } from "../../src/modules/face-id/face-id-agent.service";
import type { AgentDevice } from "../../src/modules/face-id/agent/agent-token.guard";
import type { AgentEventDto } from "../../src/modules/face-id/dto/agent-events.dto";
import { createFakePrisma, type FakePrisma } from "./fake-prisma";

const ORG = "org-1";
const BRANCH = "branch-1";

function event(serialNo: number, employeeNo: string | undefined, time: string): AgentEventDto {
  return { serialNo, employeeNo, eventTime: time, major: 5, minor: 75, verifyMode: "face", raw: { serialNo } };
}

describe("FaceIdAgentService — voqealar", () => {
  let prisma: FakePrisma;
  let service: FaceIdAgentService;
  let device: AgentDevice;
  let employeeId: string;

  beforeEach(async () => {
    prisma = createFakePrisma();
    service = new FaceIdAgentService(prisma as never);
    await prisma.branch.create({ data: { id: BRANCH, timezone: "Asia/Tashkent", openTime: "08:00" } });
    const d = await prisma.faceIdDevice.create({ data: { organizationId: ORG, branchId: BRANCH, name: "Kirish" } });
    device = { id: d.id, organizationId: ORG, branchId: BRANCH, name: "Kirish" };
    const e = await prisma.employee.create({ data: { organizationId: ORG, branchId: BRANCH, employeeNo: "1001", fullName: "Aliyeva Dilnoza" } });
    employeeId = e.id;
  });

  const day = () => prisma.employeeAttendance.rows.filter((r) => r.employeeId === employeeId);

  it("bir xil paket ikki marta kelsa — takror yozilmaydi (idempotent)", async () => {
    const batch = [event(10, "1001", "2026-09-29T07:55:00+05:00"), event(11, "1001", "2026-09-29T17:30:00+05:00")];
    const first = await service.ingestEvents(device, batch);
    const second = await service.ingestEvents(device, batch);
    expect(first.inserted).toBe(2);
    expect(second.inserted).toBe(0);
    expect(prisma.faceIdEvent.rows).toHaveLength(2);
    expect(day()).toHaveLength(1);
    expect(day()[0]).toMatchObject({ status: "PRESENT", checkInTime: "07:55", checkOutTime: "17:30" });
  });

  it("paket ichidagi takrorlar ham bitta bo'lib yoziladi", async () => {
    const e = event(10, "1001", "2026-09-29T07:55:00+05:00");
    const result = await service.ingestEvents(device, [e, { ...e }]);
    expect(result.inserted).toBe(1);
  });

  it("serialNo qayta boshlansa (qurilma tozalangan) — yangi vaqtdagi voqea yo'qolmaydi", async () => {
    await service.ingestEvents(device, [event(1, "1001", "2026-09-28T08:00:00+05:00")]);
    const result = await service.ingestEvents(device, [event(1, "1001", "2026-09-29T08:00:00+05:00")]);
    expect(result.inserted).toBe(1);
  });

  it("keyinroq kelgan voqea ketish vaqtini yangilaydi", async () => {
    await service.ingestEvents(device, [event(1, "1001", "2026-09-29T07:50:00+05:00")]);
    expect(day()[0].checkOutTime).toBeNull();
    await service.ingestEvents(device, [event(2, "1001", "2026-09-29T18:05:00+05:00")]);
    expect(day()[0]).toMatchObject({ checkInTime: "07:50", checkOutTime: "18:05" });
  });

  it("kechikkan xodim — LATE", async () => {
    await service.ingestEvents(device, [event(1, "1001", "2026-09-29T08:25:00+05:00")]);
    expect(day()[0].status).toBe("LATE");
  });

  it("admin qo'ygan holat (Kasal) o'zgarmaydi — faqat vaqtlar yoziladi", async () => {
    await prisma.employeeAttendance.create({
      data: { employeeId, branchId: BRANCH, date: new Date("2026-09-29T00:00:00.000Z"), status: "SICK" },
    });
    await service.ingestEvents(device, [event(1, "1001", "2026-09-29T09:00:00+05:00")]);
    expect(day()).toHaveLength(1);
    expect(day()[0]).toMatchObject({ status: "SICK", checkInTime: "09:00" });
  });

  it("qulflangan kunga tegilmaydi, lekin voqea saqlanadi", async () => {
    await prisma.staffAttendanceLock.create({ data: { branchId: BRANCH, date: new Date("2026-09-29T00:00:00.000Z"), lockedByName: "Admin" } });
    const result = await service.ingestEvents(device, [event(1, "1001", "2026-09-29T08:00:00+05:00")]);
    expect(result.inserted).toBe(1);
    expect(result.attendanceUpdated).toBe(0);
    expect(day()).toHaveLength(0);
  });

  it("noma'lum xodim raqami: voqea saqlanadi, davomat yozilmaydi", async () => {
    const result = await service.ingestEvents(device, [event(1, "9999", "2026-09-29T08:00:00+05:00")]);
    expect(result.inserted).toBe(1);
    expect(prisma.faceIdEvent.rows[0].employeeId).toBeNull();
    expect(prisma.employeeAttendance.rows).toHaveLength(0);
  });

  it("yarim tunda (UTC bo'yicha oldingi kun) kelgan voqea Toshkent kuniga yoziladi", async () => {
    await service.ingestEvents(device, [event(1, "1001", "2026-09-29T19:30:00Z")]);
    expect(day()[0].date.toISOString()).toBe("2026-09-30T00:00:00.000Z");
    expect(day()[0].checkInTime).toBe("00:30");
  });

  it("agent murojaati qurilmaning oxirgi aloqa vaqtini yangilaydi", async () => {
    await service.ingestEvents(device, []);
    expect(prisma.faceIdDevice.rows[0].lastSeenAt).toBeInstanceOf(Date);
  });
});

describe("FaceIdAgentService — bolalar", () => {
  let prisma: FakePrisma;
  let service: FaceIdAgentService;
  let device: AgentDevice;
  let childId: string;
  const DAY = new Date("2026-09-29T00:00:00.000Z");

  beforeEach(async () => {
    prisma = createFakePrisma();
    service = new FaceIdAgentService(prisma as never);
    await prisma.branch.create({ data: { id: BRANCH, timezone: "Asia/Tashkent", openTime: "08:00" } });
    const d = await prisma.faceIdDevice.create({ data: { organizationId: ORG, branchId: BRANCH, name: "Kirish" } });
    device = { id: d.id, organizationId: ORG, branchId: BRANCH, name: "Kirish" };
    const c = await prisma.child.create({ data: { organizationId: ORG, branchId: BRANCH, publicId: 14732, fullName: "Karimov Ali" } });
    childId = c.id;
  });

  const records = () => prisma.attendance.rows.filter((r) => r.childId === childId);

  it("C-raqamli voqea bolaga bog'lanadi: Keldi + 5 coin, kelish/ketish vaqti bilan", async () => {
    const result = await service.ingestEvents(device, [
      event(1, "C14732", "2026-09-29T08:12:00+05:00"),
      event(2, "C14732", "2026-09-29T17:40:00+05:00"),
    ]);
    expect(result.attendanceUpdated).toBe(1);
    expect(prisma.faceIdEvent.rows[0].childId).toBe(childId);
    expect(prisma.faceIdEvent.rows[0].employeeId).toBeNull();
    expect(records()).toHaveLength(1);
    expect(records()[0]).toMatchObject({ status: "PRESENT", checkInTime: "08:12", checkOutTime: "17:40", note: null });
    expect(prisma.coinTransaction.rows).toHaveLength(1);
    expect(prisma.coinTransaction.rows[0]).toMatchObject({ childId, amount: 5, source: "ATTENDANCE" });
    expect(records()[0].coinTransactionId).toBe(prisma.coinTransaction.rows[0].id);
  });

  it("takror voqea yoki ikkinchi tanish coin'ni ikki marta bermaydi", async () => {
    await service.ingestEvents(device, [event(1, "C14732", "2026-09-29T08:12:00+05:00")]);
    await service.ingestEvents(device, [event(1, "C14732", "2026-09-29T08:12:00+05:00"), event(2, "C14732", "2026-09-29T08:13:00+05:00")]);
    expect(records()).toHaveLength(1);
    expect(prisma.coinTransaction.rows).toHaveLength(1);
  });

  it("tarbiyachi belgilagan/tuzatgan holat ustun: terminal faqat vaqtni yozadi", async () => {
    await prisma.attendance.create({ data: { childId, branchId: BRANCH, date: DAY, status: "ABSENT", note: "Kasal bo'lib qoldi" } });
    await service.ingestEvents(device, [event(1, "C14732", "2026-09-29T09:05:00+05:00")]);
    expect(records()).toHaveLength(1);
    expect(records()[0]).toMatchObject({ status: "ABSENT", note: "Kasal bo'lib qoldi", checkInTime: "09:05" });
    expect(prisma.coinTransaction.rows).toHaveLength(0);
  });

  it("bolalarga kechikish avtomatik qo'yilmaydi", async () => {
    await service.ingestEvents(device, [event(1, "C14732", "2026-09-29T10:30:00+05:00")]);
    expect(records()[0].status).toBe("PRESENT");
  });

  it("boshqa tashkilotning bolasi yoki noma'lum C-raqam bog'lanmaydi", async () => {
    await prisma.child.create({ data: { organizationId: "org-2", branchId: "b-2", publicId: 55555, fullName: "Begona" } });
    await service.ingestEvents(device, [event(1, "C55555", "2026-09-29T08:00:00+05:00"), event(2, "C99999", "2026-09-29T08:01:00+05:00")]);
    expect(prisma.faceIdEvent.rows.every((r) => r.childId === null)).toBe(true);
    expect(prisma.attendance.rows).toHaveLength(0);
  });
});
