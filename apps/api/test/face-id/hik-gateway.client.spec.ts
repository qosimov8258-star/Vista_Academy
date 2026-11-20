import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HikGwClient,
  HikGwError,
  digestAuthorization,
  faceSyncErrorText,
  hikGwConfig,
  parseDigestChallenge,
} from "../../src/modules/face-id/gateway/hik-gateway.client";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const OK = { statusCode: 1, statusString: "OK", subStatusCode: "ok" };
const CHALLENGE = { "www-authenticate": 'Digest realm="r", qop="auth", nonce="n1"' };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const cfg = { baseUrl: "http://gw", username: "admin", password: "secret" };

type Call = { method: string; path: string; query: URLSearchParams; headers: Record<string, string>; body: unknown };

/** Soxta gateway: birinchi so'rovga 401 (Digest), keyin `handler` javobi. */
function fakeGateway(handler: (c: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    if (!headers.Authorization) return new Response("", { status: 401, headers: CHALLENGE });
    const u = new URL(url);
    const call: Call = { method: String(init.method), path: u.pathname, query: u.searchParams, headers, body: init.body };
    calls.push(call);
    return handler(call);
  }) as unknown as typeof fetch;
  return { client: new HikGwClient(cfg, fetchImpl), calls };
}

describe("HikGateway — Digest va sozlama", () => {
  it("RFC 2617 namunasi bilan bir xil javob chiqadi", () => {
    const header = digestAuthorization({
      challenge: { realm: "testrealm@host.com", nonce: "dcd98b7102dd2f0e8b11d0f600bfb0c093", qop: "auth,auth-int", opaque: "5ccc069c403ebaf9f0171e9517f40e41" },
      method: "GET",
      uri: "/dir/index.html",
      username: "Mufasa",
      password: "Circle Of Life",
      nc: 1,
      cnonce: "0a4f113b",
    });
    assert.ok(header.includes('response="6629fae49393a05397450978507c4ef1"'));
    assert.ok(header.includes("nc=00000001"));
  });

  it("sarlavhani o'qiydi; Digest bo'lmasa — null", () => {
    assert.deepEqual(parseDigestChallenge('Digest realm="DS-GWAS0101(6419)", qop="auth", nonce="abc="'), { realm: "DS-GWAS0101(6419)", qop: "auth", nonce: "abc=" });
    assert.equal(parseDigestChallenge('Basic realm="x"'), null);
  });

  it("env to'liq bo'lmasa gateway rejimi o'chiq", () => {
    assert.equal(hikGwConfig({}), null);
    assert.equal(hikGwConfig({ FACE_ID_GATEWAY_URL: "http://1.2.3.4/" }), null);
    assert.deepEqual(hikGwConfig({ FACE_ID_GATEWAY_URL: "http://1.2.3.4/", FACE_ID_GATEWAY_PASSWORD: "p" }), { baseUrl: "http://1.2.3.4", username: "admin", password: "p" });
  });
});

describe("HikGateway — klient", () => {
  it("401 dan keyin Digest bilan qayta yuboradi; parol noto'g'ri bo'lsa `auth`", async () => {
    const { client, calls } = fakeGateway(() => json({ SearchResult: { numOfMatches: 0, totalMatches: 0 } }));
    assert.deepEqual(await client.devices(), []);
    assert.ok(calls[0].headers.Authorization.includes('uri="/ISAPI/ContentMgmt/DeviceMgmt/deviceList?format=json"'));

    const always401 = (async () => new Response("", { status: 401, headers: CHALLENGE })) as unknown as typeof fetch;
    await assert.rejects(new HikGwClient(cfg, always401).devices(), (e: HikGwError) => e.code === "auth");
  });

  it("odam allaqachon bor — Modify bilan yangilaydi", async () => {
    const { client, calls } = fakeGateway((c) =>
      c.path.endsWith("/UserInfo/Record")
        ? json({ UserInfoOutList: { UserInfoOut: [{ employeeNo: "1001", statusCode: 6, subStatusCode: "employeeNoAlreadyExist", errorMsg: "employeeNoAlreadyExist" }] } })
        : json(OK),
    );
    await client.upsertPerson("IDX", "1001", "Aliyeva Dilnoza");
    assert.deepEqual(
      calls.map((c) => `${c.method} ${c.path}`),
      ["POST /ISAPI/AccessControl/UserInfo/Record", "PUT /ISAPI/AccessControl/UserInfo/Modify"],
    );
  });

  it("yuz FDSetUp bilan, FDID/FPID va `img` qismi bilan yuboriladi (bola raqami C… ham)", async () => {
    const { client, calls } = fakeGateway(() => json(OK));
    await client.setFace("IDX", "C14732", JPEG);
    assert.equal(`${calls[0].method} ${calls[0].path}?${calls[0].query.get("devIndex")}`, "PUT /ISAPI/Intelligent/FDLib/FDSetUp?IDX");
    const form = calls[0].body as FormData;
    assert.deepEqual(JSON.parse(await (form.get("FaceDataRecord") as Blob).text()), { faceLibType: "blackFD", FDID: "1", FPID: "C14732" });
    assert.equal((form.get("img") as Blob).size, JPEG.length);
  });

  it("terminal xatosi koddan olinadi; aloqa xatosi — vaqtinchalik", async () => {
    const { client } = fakeGateway(() => json({ statusCode: 6, statusString: "Content Error", subStatusCode: "SubpicAnalysisModelingError", errorMsg: "" }));
    const err = await client.setFace("IDX", "1001", JPEG).catch((e) => e);
    assert.ok(err instanceof HikGwError);
    assert.equal(err.code, "SubpicAnalysisModelingError");
    assert.equal(err.transient, false);
    assert.match(faceSyncErrorText(err), /yuz aniqlanmadi/);

    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await assert.rejects(new HikGwClient(cfg, down).devices(), (e: HikGwError) => e.code === "network" && e.transient);
    assert.equal(new HikGwError("theDeviceIsOffline", "x").transient, true);
  });

  it("hodisalarni AcsEvent orqali o'qiydi: major 5, sahifa va `more` belgisi", async () => {
    const { client, calls } = fakeGateway(() =>
      json({ AcsEvent: { responseStatusStrg: "MORE", numOfMatches: 2, totalMatches: 5, InfoList: [{ serialNo: 11, employeeNoString: "1001" }, { serialNo: 12, employeeNoString: "C14732" }] } }),
    );
    const res = await client.searchEvents("IDX", { startTime: "2026-11-21T00:00:00+05:00", endTime: "2026-11-21T23:59:59+05:00", position: 0 });
    assert.equal(res.more, true);
    assert.equal(res.total, 5);
    assert.deepEqual(
      res.events.map((e) => e.serialNo),
      [11, 12],
    );
    const cond = JSON.parse(String(calls[0].body)).AcsEventCond;
    assert.equal(cond.major, 5);
    assert.equal(cond.searchResultPosition, 0);
    assert.equal(cond.startTime, "2026-11-21T00:00:00+05:00");
  });

  it("gateway'dagi kalit modDevice bilan almashtiriladi", async () => {
    const { client, calls } = fakeGateway(() => json(OK));
    await client.setDeviceKey("IDX", "ZR7HY2U8", "Qw7ErTy9UiOp", "Kirish");
    assert.equal(`${calls[0].method} ${calls[0].path}`, "PUT /ISAPI/ContentMgmt/DeviceMgmt/modDevice");
    assert.deepEqual(JSON.parse(String(calls[0].body)).DeviceInfo.EhomeParams, { EhomeID: "ZR7HY2U8", EhomeKey: "Qw7ErTy9UiOp" });
  });
});
