import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { IsapiClient, IsapiError } from "../src/isapi-client";
import { buildFaceMultipart, prepareFaceJpeg, setFace, truncateUtf8 } from "../src/isapi";
import { isapiTime } from "../src/time";
import { redact } from "../src/logger";
import { loadConfig } from "../src/config";
import { MockIsapi } from "./mock-isapi";
import { bigJpeg } from "./helpers";

describe("yordamchi funksiyalar", () => {
  it("UTF-8 bo'yicha qisqartirish harfni bo'lmaydi", () => {
    // "ʻ" UTF-8 da 2 bayt: 2 baytga faqat "O" sig'adi, 3 baytga — "Oʻ"
    assert.equal(truncateUtf8("Oʻgʻiloy", 2), "O");
    assert.equal(truncateUtf8("Oʻgʻiloy", 3), "Oʻ");
    assert.equal(truncateUtf8("Aliyeva Dilnoza", 32), "Aliyeva Dilnoza");
    assert.ok(Buffer.byteLength(truncateUtf8("ЖЖЖЖЖЖ", 5)) <= 5);
  });

  it("ISAPI vaqti filial zonasida, siljish bilan", () => {
    const t = new Date("2026-09-29T03:00:00Z");
    assert.equal(isapiTime(t, "Asia/Tashkent"), "2026-09-29T08:00:00+05:00");
    assert.equal(isapiTime(t, "UTC"), "2026-09-29T03:00:00+00:00");
  });

  it("log: token, parol va Authorization yashiriladi", () => {
    const line = redact('token hik_abcDEF1234567890xyz Authorization: Bearer hik_zzzzzzzzzzzz {"password":"Maxfiy1"} digestAuth="admin:Maxfiy1"');
    assert.doesNotMatch(line, /abcDEF|zzzzzzzz|Maxfiy1/);
  });

  it("rasm ≤ chegara JPEG bo'lib kichrayadi", async () => {
    const input = await bigJpeg();
    assert.ok(input.byteLength > 200_000);
    const out = await prepareFaceJpeg(input, 200_000);
    assert.ok(out.byteLength <= 200_000);
    assert.equal(out[0], 0xff);
    assert.equal(out[1], 0xd8);
  });

  it("multipart qism nomlari .env dan olinadi", () => {
    const opts = loadConfig({ ERP_URL: "http://x", AGENT_TOKENS: "t", FACE_JSON_FIELD: "faceRecord", FACE_IMAGE_FIELD: "FaceImage" }).isapi;
    const { body } = buildFaceMultipart(opts, "1001", Buffer.from([0xff, 0xd8, 0xff]));
    const text = body.toString("latin1");
    assert.match(text, /name="faceRecord"/);
    assert.match(text, /name="FaceImage"; filename="face\.jpg"/);
    assert.match(text, /"FPID":"1001"/);
  });
});

describe("ISAPI mijoz (Digest auth)", () => {
  const device = new MockIsapi({ faceJsonField: "faceRecord", faceImageField: "FaceImage" });
  before(() => device.start());
  after(() => device.stop());

  it("noto'g'ri parol — 401 xato", async () => {
    const client = new IsapiClient({ ip: "127.0.0.1", port: device.port, username: "admin", password: "xato" });
    await assert.rejects(client.json("GET", "/ISAPI/AccessControl/UserInfo/capabilities?format=json"), (err: IsapiError) => err.httpStatus === 401);
  });

  it("boshqa proshivka qism nomlari bilan ham yuz yuklanadi (sozlama orqali)", async () => {
    const client = new IsapiClient({ ip: "127.0.0.1", port: device.port, username: "admin", password: "Qurilma123" });
    const good = loadConfig({ ERP_URL: "http://x", AGENT_TOKENS: "t", FACE_JSON_FIELD: "faceRecord", FACE_IMAGE_FIELD: "FaceImage" }).isapi;
    const bad = loadConfig({ ERP_URL: "http://x", AGENT_TOKENS: "t" }).isapi;
    const jpeg = await bigJpeg(200);
    await assert.rejects(setFace(client, bad, "2001", jpeg), (err: IsapiError) => err.subStatusCode === "badParameters");
    await setFace(client, good, "2001", jpeg);
    assert.ok(device.faces.has("2001"));
  });

  it("qurilma o'chiq — tarmoq xatosi (network)", async () => {
    const client = new IsapiClient({ ip: "127.0.0.1", port: 1, username: "admin", password: "x" }, 2000);
    await assert.rejects(client.json("GET", "/ISAPI/System/deviceInfo"), (err: IsapiError) => err.network);
  });
});
