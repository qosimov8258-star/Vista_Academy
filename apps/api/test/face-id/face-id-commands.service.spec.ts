import { beforeEach, describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { FaceIdCommandsService, MAX_COMMAND_ATTEMPTS, SENT_TIMEOUT_MS } from "../../src/modules/face-id/face-id-commands.service";
import type { AgentDevice } from "../../src/modules/face-id/agent/agent-token.guard";
import { createFakePrisma, type FakePrisma } from "./fake-prisma";

const ORG = "org-1";
const BRANCH = "branch-1";

describe("FaceIdCommandsService — buyruqlar navbati", () => {
  let prisma: FakePrisma;
  let service: FaceIdCommandsService;
  let device: AgentDevice;
  let employeeId: string;

  beforeEach(async () => {
    prisma = createFakePrisma();
    service = new FaceIdCommandsService(prisma as never);
    const d = await prisma.faceIdDevice.create({ data: { organizationId: ORG, branchId: BRANCH, name: "Kirish" } });
    // Boshqa filial va o'chirilgan qurilma — ularga buyruq ketmasligi kerak
    await prisma.faceIdDevice.create({ data: { organizationId: ORG, branchId: "branch-2", name: "Boshqa filial" } });
    await prisma.faceIdDevice.create({ data: { organizationId: ORG, branchId: BRANCH, name: "O'chiq", status: "INACTIVE" } });
    device = { id: d.id, organizationId: ORG, branchId: BRANCH, name: "Kirish" };
    const e = await prisma.employee.create({
      data: { organizationId: ORG, branchId: BRANCH, employeeNo: "1001", fullName: "Aliyeva Dilnoza", avatar: Buffer.from("jpeg"), avatarMimeType: "image/jpeg", avatarUpdatedAt: new Date() },
    });
    employeeId = e.id;
  });

  const commands = () => prisma.faceIdCommand.rows;

  it("xodim yaratilsa: faqat filialdagi faol qurilmaga ADD va SET_FACE, yuz ro'yxatiga yozuv", async () => {
    await service.enqueueEmployeeSync(employeeId);
    expect(commands().map((c) => [c.deviceId, c.type])).toEqual([
      [device.id, "ADD_OR_UPDATE_USER"],
      [device.id, "SET_FACE"],
    ]);
    expect(commands()[0].payload).toEqual({ employeeNo: "1001", name: "Aliyeva Dilnoza" });
    expect(prisma.faceEnrollment.rows).toHaveLength(1);
  });

  it("navbatdagi buyruq takrorlanmaydi — payload yangilanadi", async () => {
    await service.enqueueEmployeeSync(employeeId);
    prisma.employee.rows[0].fullName = "Aliyeva Dilnoza Karimovna";
    await service.enqueueEmployeeSync(employeeId);
    expect(commands()).toHaveLength(2);
    expect(commands()[0].payload).toMatchObject({ name: "Aliyeva Dilnoza Karimovna" });
    expect(prisma.faceEnrollment.rows).toHaveLength(1);
  });

  it("dispatch: tartib bo'yicha, limit bilan, SENT va urinish +1; ikkinchi marta berilmaydi", async () => {
    await service.enqueueEmployeeSync(employeeId);
    const first = await service.dispatch(device, 1);
    expect(first.map((c) => c.type)).toEqual(["ADD_OR_UPDATE_USER"]);
    expect(first[0].attempts).toBe(1);
    const second = await service.dispatch(device, 10);
    expect(second.map((c) => c.type)).toEqual(["SET_FACE"]);
    expect(await service.dispatch(device, 10)).toEqual([]);
  });

  it("javobsiz qolgan SENT buyruq muddatdan keyin qayta beriladi", async () => {
    await service.enqueueEmployeeSync(employeeId);
    const t0 = new Date("2026-09-29T08:00:00Z");
    await service.dispatch(device, 10, t0);
    expect(await service.dispatch(device, 10, new Date(t0.getTime() + SENT_TIMEOUT_MS - 1000))).toEqual([]);
    const again = await service.dispatch(device, 10, new Date(t0.getTime() + SENT_TIMEOUT_MS + 1000));
    expect(again).toHaveLength(2);
    expect(again[0].attempts).toBe(2);
  });

  it("ack muvaffaqiyat: DONE, SET_FACE yuz ro'yxatini REGISTERED qiladi", async () => {
    await service.enqueueEmployeeSync(employeeId);
    const sent = await service.dispatch(device, 10);
    for (const c of sent) await service.ack(device, c.id, { success: true });
    expect(commands().every((c) => c.status === "DONE")).toBe(true);
    expect(prisma.faceEnrollment.rows[0].status).toBe("REGISTERED");
  });

  it("ack xato: urinishlar tugaguncha qayta navbat, keyin FAILED", async () => {
    await service.enqueueEmployeeSync(employeeId);
    for (let i = 1; i <= MAX_COMMAND_ATTEMPTS; i++) {
      const [cmd] = await service.dispatch(device, 1);
      expect(cmd.attempts).toBe(i);
      const result = await service.ack(device, cmd.id, { success: false, error: "statusCode 4: employeeNoAlreadyExist" });
      expect(result.status).toBe(i < MAX_COMMAND_ATTEMPTS ? "PENDING" : "FAILED");
    }
    const add = commands().find((c) => c.type === "ADD_OR_UPDATE_USER")!;
    expect(add).toMatchObject({ status: "FAILED", lastError: "statusCode 4: employeeNoAlreadyExist" });
    expect(prisma.faceEnrollment.rows[0].status).toBe("FAILED");
  });

  it("takror ack holatni buzmaydi", async () => {
    await service.enqueueEmployeeSync(employeeId);
    const [cmd] = await service.dispatch(device, 1);
    await service.ack(device, cmd.id, { success: true });
    const again = await service.ack(device, cmd.id, { success: false, error: "kech kelgan xato" });
    expect(again.status).toBe("DONE");
    expect(commands()[0].lastError).toBeNull();
  });

  it("boshqa qurilma buyrug'iga ack berib bo'lmaydi", async () => {
    await service.enqueueEmployeeSync(employeeId);
    const [cmd] = await service.dispatch(device, 1);
    const stranger: AgentDevice = { ...device, id: "boshqa-qurilma" };
    await expect(service.ack(stranger, cmd.id, { success: true })).rejects.toThrow("Buyruq topilmadi");
  });

  it("xodim o'chirilsa: navbatdagi qo'shish bekor, DELETE_USER qo'yiladi", async () => {
    await service.enqueueEmployeeSync(employeeId);
    await service.enqueueDelete({ organizationId: ORG, branchId: BRANCH, employeeNo: "1001" });
    const byType = Object.fromEntries(commands().map((c) => [c.type, c]));
    expect(byType.ADD_OR_UPDATE_USER.status).toBe("FAILED");
    expect(byType.SET_FACE.status).toBe("FAILED");
    expect(byType.DELETE_USER).toMatchObject({ status: "PENDING", employeeNo: "1001", payload: { employeeNo: "1001" } });
    const sent = await service.dispatch(device, 10);
    expect(sent.map((c) => c.type)).toEqual(["DELETE_USER"]);
  });

  it("surati yo'q xodimga SET_FACE qo'yilmaydi; to'liq sinxronlash hammasini qamraydi", async () => {
    await prisma.employee.create({ data: { organizationId: ORG, branchId: BRANCH, employeeNo: "1002", fullName: "Suratsiz" } });
    await prisma.employee.create({ data: { organizationId: ORG, branchId: BRANCH, employeeNo: "1003", fullName: "Bo'shagan", isActive: false } });
    const result = await service.enqueueFullSync(device);
    expect(result).toEqual({ employees: 2, children: 0 });
    expect(commands().map((c) => `${c.employeeNo}:${c.type}`)).toEqual(["1001:ADD_OR_UPDATE_USER", "1001:SET_FACE", "1002:ADD_OR_UPDATE_USER"]);
  });

  it("SET_FACE uchun surat agentga beriladi", async () => {
    await service.enqueueFace(employeeId);
    const [cmd] = await service.dispatch(device, 1);
    const image = await service.faceImage(device, cmd.id);
    expect(image.mimeType).toBe("image/jpeg");
    expect(image.data.toString()).toBe("jpeg");
  });
});

describe("FaceIdCommandsService — bolalar", () => {
  let prisma: FakePrisma;
  let service: FaceIdCommandsService;
  let device: AgentDevice;
  let childId: string;

  beforeEach(async () => {
    prisma = createFakePrisma();
    service = new FaceIdCommandsService(prisma as never);
    const d = await prisma.faceIdDevice.create({ data: { organizationId: ORG, branchId: BRANCH, name: "Kirish" } });
    device = { id: d.id, organizationId: ORG, branchId: BRANCH, name: "Kirish" };
    const c = await prisma.child.create({
      data: { organizationId: ORG, branchId: BRANCH, publicId: 14732, fullName: "Karimov Ali", avatar: Buffer.from("bola-jpeg"), avatarMimeType: "image/jpeg", avatarUpdatedAt: new Date() },
    });
    childId = c.id;
  });

  const commands = () => prisma.faceIdCommand.rows;

  it("bola terminalga C-prefiksli raqam bilan qo'shiladi (yuzi bilan), yuz ro'yxatida CHILD", async () => {
    await service.enqueueChildSync(childId);
    expect(commands().map((c) => `${c.employeeNo}:${c.type}`)).toEqual(["C14732:ADD_OR_UPDATE_USER", "C14732:SET_FACE"]);
    expect(commands()[0]).toMatchObject({ childId, employeeId: null, payload: { employeeNo: "C14732", name: "Karimov Ali" } });
    expect(prisma.faceEnrollment.rows[0]).toMatchObject({ personType: "CHILD", childId });
  });

  it("nofaol qilingan bola terminaldan o'chiriladi, navbatdagi qo'shish bekor", async () => {
    await service.enqueueChildSync(childId);
    prisma.child.rows[0].status = "INACTIVE";
    await service.enqueueChildSync(childId);
    const byType = Object.fromEntries(commands().map((c) => [c.type, c]));
    expect(byType.ADD_OR_UPDATE_USER.status).toBe("FAILED");
    expect(byType.DELETE_USER).toMatchObject({ status: "PENDING", employeeNo: "C14732" });
  });

  it("SET_FACE bajarilsa bola yuzi ro'yxatda REGISTERED; surat agentga beriladi", async () => {
    await service.enqueueChildSync(childId);
    const sent = await service.dispatch(device, 10);
    const face = sent.find((c) => c.type === "SET_FACE")!;
    expect((await service.faceImage(device, face.id)).data.toString()).toBe("bola-jpeg");
    for (const c of sent) await service.ack(device, c.id, { success: true });
    expect(prisma.faceEnrollment.rows[0].status).toBe("REGISTERED");
  });

  it("to'liq sinxronlash nofaol bolani qo'shmaydi, karantindagini qo'shadi", async () => {
    await prisma.child.create({ data: { organizationId: ORG, branchId: BRANCH, publicId: 20001, fullName: "Ketgan", status: "INACTIVE" } });
    await prisma.child.create({ data: { organizationId: ORG, branchId: BRANCH, publicId: 20002, fullName: "Karantinda", status: "QUARANTINED" } });
    const result = await service.enqueueFullSync(device);
    expect(result).toEqual({ employees: 0, children: 2 });
    expect(commands().some((c) => c.employeeNo === "C20001")).toBe(false);
    expect(commands().some((c) => c.employeeNo === "C20002")).toBe(true);
  });
});
