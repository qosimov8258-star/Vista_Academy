import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { DeviceWorker } from "../src/device-worker";
import { setLogLevel } from "../src/logger";
import { MockErp } from "./mock-erp";
import { MockIsapi } from "./mock-isapi";
import { bigJpeg, tashkent, tempDir, testConfig } from "./helpers";

setLogLevel("error");

describe("DeviceWorker (mock ISAPI + mock ERP)", () => {
  let erp: MockErp;
  let isapi: MockIsapi;
  let dataDir: string;
  let clock: number;
  const makeWorker = () => new DeviceWorker(erp.token, testConfig(erp.url, erp.token, dataDir), () => clock);

  beforeEach(async () => {
    erp = new MockErp();
    isapi = new MockIsapi();
    await erp.start();
    await isapi.start();
    erp.device.port = isapi.port;
    dataDir = tempDir();
    clock = Date.parse(tashkent("12:00:00"));
  });
  afterEach(async () => {
    await erp.stop();
    await isapi.stop().catch(() => undefined);
  });

  const addEvents = (from: number, count: number, withEmployee = true, hour = 8) => {
    for (let i = 0; i < count; i++) {
      const s = from + i;
      isapi.events.push({ serialNo: s, time: tashkent(`${String(hour).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`), employeeNoString: withEmployee ? String(1000 + (s % 5)) : undefined });
    }
  };

  it("voqealarni sahifalab o'qiydi, faqat employeeNo borlarini yuboradi va holatni saqlaydi", async () => {
    addEvents(1, 40);
    addEvents(41, 5, false);
    await makeWorker().tick();
    assert.equal(erp.received.length, 40);
    assert.ok(isapi.calls.filter((c) => c === "POST /ISAPI/AccessControl/AcsEvent").length >= 2, "MORE bo'lsa keyingi sahifa so'ralishi kerak");
    const state = JSON.parse(readFileSync(path.join(dataDir, "state-dev-1.json"), "utf8"));
    assert.equal(state.lastSyncedTo, new Date(clock).toISOString());
    const sample = erp.received[0];
    assert.equal(sample.major, 5);
    assert.equal(sample.minor, 75);
    assert.match(sample.eventTime, /\+05:00$/);
  });

  it("keyingi aylanishda yangi voqea qo'shiladi, eskilari takrorlanmaydi", async () => {
    addEvents(1, 3);
    const worker = makeWorker();
    await worker.tick();
    isapi.events.push({ serialNo: 99, time: tashkent("12:03:00"), employeeNoString: "1001" });
    clock += 5 * 60_000;
    await worker.tick();
    assert.deepEqual(erp.received.map((e) => e.serialNo).sort((a, b) => a - b), [1, 2, 3, 99]);
  });

  it("ERP ishlamasa voqealar lokal navbatda saqlanadi va keyin (agent qayta ishga tushsa ham) yetkaziladi", async () => {
    addEvents(1, 12);
    erp.eventsDown = true;
    await makeWorker().tick();
    assert.equal(erp.received.length, 0);
    const queue = JSON.parse(readFileSync(path.join(dataDir, "queue-dev-1.json"), "utf8"));
    assert.equal(queue.length, 12);

    erp.eventsDown = false;
    clock += 10 * 60_000;
    await makeWorker().tick(); // yangi jarayon — navbat fayldan olinadi
    assert.equal(erp.received.length, 12);
    assert.deepEqual(JSON.parse(readFileSync(path.join(dataDir, "queue-dev-1.json"), "utf8")), []);
  });

  it("buyruqlar: qo'shish, mavjudini o'zgartirish, yuz (≤200 KB), o'chirish", async () => {
    isapi.users.set("1002", { name: "Eski ism", userType: "normal", doorRight: "1" });
    isapi.users.set("1003", { name: "Ketgan xodim", userType: "normal", doorRight: "1" });
    isapi.faces.set("1003", { meta: {}, jpegBytes: 1, partNames: [], imageContentType: "image/jpeg" });
    erp.faces.set("c-face", await bigJpeg());
    erp.commands = [
      { id: "c-add", type: "ADD_OR_UPDATE_USER", employeeNo: "1001", payload: { employeeNo: "1001", name: "Abdurahmonova Gulchehra Xolmatovna O'g'li" }, attempts: 1 },
      { id: "c-mod", type: "ADD_OR_UPDATE_USER", employeeNo: "1002", payload: { employeeNo: "1002", name: "Yangi ism" }, attempts: 1 },
      { id: "c-face", type: "SET_FACE", employeeNo: "1001", payload: { employeeNo: "1001" }, attempts: 1 },
      { id: "c-del", type: "DELETE_USER", employeeNo: "1003", payload: { employeeNo: "1003" }, attempts: 1 },
    ];
    await makeWorker().tick();

    assert.deepEqual(erp.acks.map((a) => [a.id, a.success]), [["c-add", true], ["c-mod", true], ["c-face", true], ["c-del", true]]);
    const added = isapi.users.get("1001")!;
    assert.ok(Buffer.byteLength(added.name, "utf8") <= 32, "ism qurilma chegarasiga qisqartirilishi kerak");
    assert.equal(added.userType, "normal");
    assert.equal(isapi.users.get("1002")!.name, "Yangi ism");
    assert.ok(isapi.calls.includes("PUT /ISAPI/AccessControl/UserInfo/Modify"));
    const face = isapi.faces.get("1001")!;
    assert.ok(face.jpegBytes <= 200_000, `yuz ${face.jpegBytes} bayt`);
    assert.deepEqual(face.partNames, ["FaceDataRecord", "img"]);
    assert.equal(face.imageContentType, "image/jpeg");
    assert.deepEqual(face.meta, { faceLibType: "blackFD", FDID: "1", FPID: "1001" });
    assert.equal(isapi.users.has("1003"), false);
    assert.equal(isapi.faces.has("1003"), false);
  });

  it("yuz allaqachon bo'lsa — o'chirib, qayta yuklaydi", async () => {
    isapi.users.set("1001", { name: "A", userType: "normal", doorRight: "1" });
    isapi.faces.set("1001", { meta: {}, jpegBytes: 1, partNames: [], imageContentType: "image/jpeg" });
    erp.faces.set("c-face", await bigJpeg(300));
    erp.commands = [{ id: "c-face", type: "SET_FACE", employeeNo: "1001", payload: { employeeNo: "1001" }, attempts: 1 }];
    await makeWorker().tick();
    assert.deepEqual(erp.acks, [{ id: "c-face", success: true }]);
    assert.ok(isapi.calls.includes("PUT /ISAPI/Intelligent/FDLib/FDSearch/Delete"));
    assert.ok(isapi.faces.get("1001")!.jpegBytes > 1);
  });

  it("qurilma xatosi (statusCode/subStatusCode) ack'da qaytariladi; surat yo'q bo'lsa ham", async () => {
    isapi.rejectEmployeeNo = "1009";
    erp.commands = [
      { id: "c-bad", type: "ADD_OR_UPDATE_USER", employeeNo: "1009", payload: { employeeNo: "1009", name: "X" }, attempts: 2 },
      { id: "c-noface", type: "SET_FACE", employeeNo: "1001", payload: { employeeNo: "1001" }, attempts: 1 },
    ];
    await makeWorker().tick();
    assert.equal(erp.acks[0].success, false);
    assert.match(erp.acks[0].error!, /statusCode 4.*subStatusCode badParameters/);
    assert.deepEqual(erp.acks[1], { id: "c-noface", success: false, error: "Xodimda surat yo'q" });
  });

  it("qurilma ulanmasa buyruq olinmaydi va ack yuborilmaydi; qayta ulangach davom etadi", async () => {
    const port = isapi.port;
    await isapi.stop();
    erp.commands = [{ id: "c-add", type: "ADD_OR_UPDATE_USER", employeeNo: "1001", payload: { employeeNo: "1001", name: "A" }, attempts: 1 }];
    const worker = makeWorker();
    await worker.tick();
    assert.equal(erp.commandsFetched, 0);
    assert.equal(erp.acks.length, 0);

    await isapi.start(port);
    await worker.tick(); // hali backoff vaqti tugamagan
    assert.equal(erp.commandsFetched, 0);
    clock += 60_000;
    await worker.tick();
    assert.deepEqual(erp.acks, [{ id: "c-add", success: true }]);
  });

  it("qurilma paroli noto'g'ri bo'lsa (401) buyruqlar olinmaydi", async () => {
    erp.device.password = "notogri";
    erp.commands = [{ id: "c-add", type: "ADD_OR_UPDATE_USER", employeeNo: "1001", payload: { employeeNo: "1001", name: "A" }, attempts: 1 }];
    await makeWorker().tick();
    assert.equal(erp.commandsFetched, 0);
    assert.equal(existsSync(path.join(dataDir, "state-dev-1.json")), false);
  });
});
