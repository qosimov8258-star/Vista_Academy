import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { FaceIdCommandsService } from "../../src/modules/face-id/face-id-commands.service";
import type { AgentDevice } from "../../src/modules/face-id/agent/agent-token.guard";
import { FaceIdGatewayService, toAgentEvent } from "../../src/modules/face-id/gateway/face-id-gateway.service";
import { HikGwError } from "../../src/modules/face-id/gateway/hik-gateway.client";
import { isStrongIsupKey, isapiTime, newIsupDeviceId, newIsupKey, truncateUtf8 } from "../../src/modules/face-id/gateway/gateway-rules";
import { createFakePrisma } from "./fake-prisma";

const NOW = new Date("2026-11-21T04:00:00.000Z");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

type Call = [string, ...unknown[]];

/** Yozib boruvchi soxta gateway; `fail` — ko'rsatilgan amalda xato tashlaydi. */
function fakeApi(opts: { online?: boolean; events?: Record<string, unknown>[]; fail?: Partial<Record<string, Error>> } = {}) {
  const calls: Call[] = [];
  const op =
    (name: string, result?: unknown) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args]);
      if (opts.fail?.[name]) throw opts.fail[name];
      return result;
    };
  const api = {
    devices: async () => [
      { devIndex: "IDX", ehomeId: "ZRAAAAAA", name: "Kirish", online: opts.online ?? true, model: "DS-K1T342EX", version: "V4", offlineHint: 0 },
    ],
    addDevice: op("addDevice", "NEW-IDX"),
    setDeviceKey: op("setDeviceKey"),
    deleteDevice: op("deleteDevice"),
    upsertPerson: op("upsertPerson"),
    setFace: op("setFace"),
    removePerson: op("removePerson"),
    searchEvents: async (...args: unknown[]) => {
      calls.push(["searchEvents", ...args]);
      return { events: opts.events ?? [], more: false, total: (opts.events ?? []).length };
    },
  };
  return { api, calls };
}

function setup(
  opts: Parameters<typeof fakeApi>[0] & { commands?: { id: string; type: string; employeeNo: string; payload: unknown }[]; since?: Date | null } = {},
) {
  const device = {
    id: "dev1",
    organizationId: "org1",
    branchId: "br1",
    name: "Kirish",
    gatewayIndex: "IDX",
    gatewayEventsSince: opts.since ?? null,
    branch: { timezone: "Asia/Tashkent" },
  };
  const updates: unknown[] = [];
  const prisma = {
    organization: { findUnique: async () => null },
    faceIdDevice: {
      findMany: async () => [device],
      update: async (args: unknown) => (updates.push(args), { id: "dev1" }),
    },
  };
  const acks: Call[] = [];
  const released: string[][] = [];
  const commands = {
    dispatch: async () => (opts.commands ?? []).map((c) => ({ ...c, attempts: 1 })),
    ack: async (_d: AgentDevice, id: string, dto: { success: boolean; error?: string }) => (acks.push([id, dto.success, dto.error]), { id, status: "DONE" }),
    release: async (_d: AgentDevice, ids: string[]) => void released.push(ids),
    faceImage: async () => ({ data: JPEG, mimeType: "image/jpeg" }),
  };
  const ingested: unknown[][] = [];
  const touched: string[] = [];
  const agent = {
    touch: async (id: string) => void touched.push(id),
    ingestEvents: async (_d: AgentDevice, events: unknown[]) => (
      ingested.push(events), { received: events.length, inserted: events.length, attendanceUpdated: 0 }
    ),
  };
  const { api, calls } = fakeApi(opts);
  const svc = new FaceIdGatewayService(prisma as never, commands as never, agent as never, {} as never);
  svc.useClient(api as never);
  return { svc, calls, acks, released, ingested, touched, updates };
}

describe("Face ID gateway — qoidalar", () => {
  it("kalit terminal talabiga mos: 8–16 belgi, katta + kichik harf + raqam", () => {
    for (let i = 0; i < 200; i++) assert.ok(isStrongIsupKey(newIsupKey()));
    assert.equal(isStrongIsupKey("abcdefghijkl"), false); // haqiqiy terminal rad etgan
    assert.match(newIsupDeviceId(), /^ZR[A-Z2-9]{6}$/);
  });

  it("ISAPI vaqti filial zonasi bilan; ism baytlar bo'yicha qisqaradi", () => {
    assert.equal(isapiTime(NOW, "Asia/Tashkent"), "2026-11-21T09:00:00+05:00");
    assert.equal(isapiTime(NOW, "UTC"), "2026-11-21T04:00:00+00:00");
    assert.equal(truncateUtf8("Абдуллаев Жасурбек Шавкатович", 32), "Абдуллаев Жасурб"); // kirill 2 baytdan: 31 bayt, keyingi harf sig'maydi
  });

  it("InfoList yozuvi agent hodisasiga aylanadi; odam aniqlanmagani tashlanadi", () => {
    assert.deepEqual(
      toAgentEvent({ serialNo: 7, employeeNoString: "C14732", time: "2026-11-21T08:01:00+05:00", major: 5, minor: 75, currentVerifyMode: "face" }),
      {
        serialNo: 7,
        employeeNo: "C14732",
        eventTime: "2026-11-21T08:01:00+05:00",
        major: 5,
        minor: 75,
        verifyMode: "face",
        pictureUrl: undefined,
        raw: { serialNo: 7, employeeNoString: "C14732", time: "2026-11-21T08:01:00+05:00", major: 5, minor: 75, currentVerifyMode: "face" },
      },
    );
    assert.equal(toAgentEvent({ serialNo: 8, time: "2026-11-21T08:01:00+05:00" }), null);
  });
});

describe("Face ID gateway — ishchi", () => {
  it("buyruqlar tartibi bilan terminalda bajariladi va DONE bo'ladi", async () => {
    const { svc, calls, acks, touched } = setup({
      commands: [
        { id: "c1", type: "ADD_OR_UPDATE_USER", employeeNo: "1001", payload: { employeeNo: "1001", name: "Aliyeva Dilnoza" } },
        { id: "c2", type: "SET_FACE", employeeNo: "1001", payload: {} },
        { id: "c3", type: "DELETE_USER", employeeNo: "C14732", payload: {} },
      ],
    });
    assert.deepEqual(await svc.runOnce(NOW), { commands: 3, failed: 0, events: 0 });
    assert.deepEqual(touched, ["dev1"]);
    assert.deepEqual(
      calls.slice(0, 3).map((c) => c.slice(0, 3)),
      [
        ["upsertPerson", "IDX", "1001"],
        ["setFace", "IDX", "1001"],
        ["removePerson", "IDX", "C14732"],
      ],
    );
    assert.equal(calls[0][3], "Aliyeva Dilnoza");
    assert.ok(Buffer.isBuffer(calls[1][3]));
    assert.deepEqual(acks, [
      ["c1", true, undefined],
      ["c2", true, undefined],
      ["c3", true, undefined],
    ]);
  });

  it("yaroqsiz rasm — buyruq xato bilan yopiladi, qolganlari davom etadi", async () => {
    const { svc, acks } = setup({
      commands: [
        { id: "c1", type: "SET_FACE", employeeNo: "1001", payload: {} },
        { id: "c2", type: "DELETE_USER", employeeNo: "1002", payload: {} },
      ],
      fail: { setFace: new HikGwError("SubpicAnalysisModelingError", "") },
    });
    assert.deepEqual(await svc.runOnce(NOW), { commands: 1, failed: 1, events: 0 });
    assert.equal(acks[0][1], false);
    assert.match(String(acks[0][2]), /yuz aniqlanmadi/);
    assert.deepEqual(acks[1], ["c2", true, undefined]);
  });

  it("aloqa uzilsa qolgan buyruqlar navbatga qaytadi (urinish sanalmaydi)", async () => {
    const { svc, acks, released } = setup({
      commands: [
        { id: "c1", type: "ADD_OR_UPDATE_USER", employeeNo: "1001", payload: { name: "A" } },
        { id: "c2", type: "SET_FACE", employeeNo: "1001", payload: {} },
      ],
      fail: { upsertPerson: new HikGwError("theDeviceIsOffline", "offline") },
    });
    assert.deepEqual(await svc.runOnce(NOW), { commands: 0, failed: 0, events: 0 });
    assert.deepEqual(acks, []);
    assert.deepEqual(released, [["c1", "c2"]]);
  });

  it("terminal o'chiq — buyruqlar ham, hodisalar ham so'ralmaydi", async () => {
    const { svc, calls, touched } = setup({ online: false, commands: [{ id: "c1", type: "DELETE_USER", employeeNo: "1", payload: {} }] });
    assert.deepEqual(await svc.runOnce(NOW), { commands: 0, failed: 0, events: 0 });
    assert.deepEqual(calls, []);
    assert.deepEqual(touched, []);
  });

  it("hodisalar: birinchi marta 24 soat orqaga, keyin oxirgi o'qilgan vaqtdan 2 daqiqa ustma-ust", async () => {
    const events = [
      { serialNo: 11, employeeNoString: "1001", time: "2026-11-21T08:58:00+05:00", major: 5, minor: 75 },
      { serialNo: 12, time: "2026-11-21T08:59:00+05:00", major: 5, minor: 76 }, // tanilmagan yuz
    ];
    const first = setup({ events });
    assert.deepEqual(await first.svc.runOnce(NOW), { commands: 0, failed: 0, events: 1 });
    const q1 = first.calls.find((c) => c[0] === "searchEvents")![2] as { startTime: string; endTime: string };
    assert.equal(q1.startTime, "2026-11-20T09:00:00+05:00");
    assert.equal(q1.endTime, "2026-11-21T09:00:00+05:00");
    assert.equal((first.ingested[0] as { serialNo: number }[]).length, 1);
    assert.deepEqual(first.updates.at(-1), { where: { id: "dev1" }, data: { gatewayEventsSince: NOW }, select: { id: true } });

    const next = setup({ since: new Date("2026-11-21T03:59:40.000Z") });
    await next.svc.runOnce(NOW);
    const q2 = next.calls.find((c) => c[0] === "searchEvents")![2] as { startTime: string };
    assert.equal(q2.startTime, "2026-11-21T08:57:40+05:00");
  });
});

describe("Face ID buyruqlari — navbatga qaytarish", () => {
  const device: AgentDevice = { id: "", organizationId: "org1", branchId: "br1", name: "Kirish" };
  let prisma: ReturnType<typeof createFakePrisma>;
  let service: FaceIdCommandsService;

  beforeEach(async () => {
    prisma = createFakePrisma();
    service = new FaceIdCommandsService(prisma as never, {} as never);
    const d = await prisma.faceIdDevice.create({ data: { organizationId: "org1", branchId: "br1", name: "Kirish" } });
    device.id = d.id;
    await prisma.faceIdCommand.create({
      data: {
        organizationId: "org1",
        branchId: "br1",
        deviceId: d.id,
        employeeNo: "1001",
        type: "ADD_OR_UPDATE_USER",
        payload: {},
        status: "PENDING",
        attempts: 0,
      },
    });
  });

  it("release: SENT buyruq PENDING ga qaytadi va urinish hisobi tiklanadi", async () => {
    const [sent] = await service.dispatch(device, 10, NOW);
    assert.equal(prisma.faceIdCommand.rows[0].status, "SENT");
    assert.equal(prisma.faceIdCommand.rows[0].attempts, 1);
    await service.release(device, [sent.id]);
    assert.equal(prisma.faceIdCommand.rows[0].status, "PENDING");
    assert.equal(prisma.faceIdCommand.rows[0].attempts, 0);
    // Qayta olinadi — buyruq yo'qolmagan
    assert.equal((await service.dispatch(device, 10, NOW)).length, 1);
  });
});
