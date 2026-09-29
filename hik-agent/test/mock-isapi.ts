/**
 * Sinovlar uchun soxta Hikvision ISAPI server: haqiqiy Digest auth (qop=auth)
 * bilan, agent ishlatadigan endpointlarni xotirada bajaradi. Javob shakllari
 * Hikvision ISAPI hujjatidagi kabi ({ statusCode, subStatusCode, ... }).
 */
import { createHash, randomBytes } from "crypto";
import http from "http";
import type { AddressInfo } from "net";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const REALM = "IP Camera(K1T342)";

export interface MockEvent {
  serialNo: number;
  time: string;
  employeeNoString?: string;
  major?: number;
  minor?: number;
}

export interface MockFace {
  meta: Record<string, string>;
  jpegBytes: number;
  partNames: string[];
  imageContentType: string;
}

export interface MockIsapiOptions {
  username?: string;
  password?: string;
  /** Qurilma kutgan multipart qism nomlari */
  faceJsonField?: string;
  faceImageField?: string;
  nameMax?: number;
}

export class MockIsapi {
  readonly users = new Map<string, { name: string; userType: string; doorRight: string }>();
  readonly faces = new Map<string, MockFace>();
  events: MockEvent[] = [];
  readonly calls: string[] = [];
  /** Shu raqamli xodim qo'shilganda qurilma xato qaytaradi */
  rejectEmployeeNo: string | null = null;
  private readonly nonces = new Set<string>();
  private server!: http.Server;
  port = 0;
  readonly opts: Required<MockIsapiOptions>;

  constructor(opts: MockIsapiOptions = {}) {
    this.opts = {
      username: opts.username ?? "admin",
      password: opts.password ?? "Qurilma123",
      faceJsonField: opts.faceJsonField ?? "FaceDataRecord",
      faceImageField: opts.faceImageField ?? "img",
      nameMax: opts.nameMax ?? 32,
    };
  }

  async start(port = 0): Promise<void> {
    this.server = http.createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve) => this.server.listen(port, "127.0.0.1", resolve));
    this.port = (this.server.address() as AddressInfo).port;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections?.();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private authorized(req: http.IncomingMessage): boolean {
    const header = req.headers.authorization ?? "";
    if (!header.startsWith("Digest ")) return false;
    const params = Object.fromEntries(
      [...header.slice(7).matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)].map((m) => [m[1], m[2] ?? m[3]]),
    );
    if (params.username !== this.opts.username || !this.nonces.has(params.nonce)) return false;
    const ha1 = md5(`${params.username}:${REALM}:${this.opts.password}`);
    const ha2 = md5(`${req.method}:${params.uri}`);
    const expected = md5(`${ha1}:${params.nonce}:${params.nc}:${params.cnonce}:${params.qop}:${ha2}`);
    return expected === params.response;
  }

  private json(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }

  private ok(res: http.ServerResponse) {
    this.json(res, 200, { statusCode: 1, statusString: "OK", subStatusCode: "ok" });
  }

  private fail(res: http.ServerResponse, statusCode: number, subStatusCode: string, errorMsg = subStatusCode) {
    this.json(res, 400, { statusCode, statusString: "Invalid Operation", subStatusCode, errorCode: 0x60000000 + statusCode, errorMsg });
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);

    if (!this.authorized(req)) {
      const nonce = randomBytes(16).toString("hex");
      this.nonces.add(nonce);
      res.writeHead(401, { "WWW-Authenticate": `Digest realm="${REALM}", qop="auth", nonce="${nonce}", opaque="${randomBytes(8).toString("hex")}"` });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://device");
    const route = `${req.method} ${url.pathname}`;
    this.calls.push(route);
    const parse = () => JSON.parse(body.toString("utf8") || "{}");

    switch (route) {
      case "POST /ISAPI/AccessControl/AcsEvent": {
        const cond = parse().AcsEventCond;
        const from = new Date(cond.startTime).getTime();
        const to = new Date(cond.endTime).getTime();
        const matching = this.events.filter((e) => {
          const t = new Date(e.time).getTime();
          return t >= from && t <= to;
        });
        const max = Math.min(cond.maxResults, 30);
        const page = matching.slice(cond.searchResultPosition, cond.searchResultPosition + max);
        const more = cond.searchResultPosition + page.length < matching.length;
        return this.json(res, 200, {
          AcsEvent: {
            searchID: cond.searchID,
            responseStatusStrg: page.length === 0 ? "NO MATCH" : more ? "MORE" : "OK",
            numOfMatches: page.length,
            totalMatches: matching.length,
            InfoList: page.map((e) => ({ major: e.major ?? 5, minor: e.minor ?? 75, time: e.time, serialNo: e.serialNo, employeeNoString: e.employeeNoString, currentVerifyMode: "face" })),
          },
        });
      }
      case "GET /ISAPI/AccessControl/UserInfo/capabilities":
        return this.json(res, 200, { UserInfo: { employeeNo: { "@min": 1, "@max": 32 }, name: { "@min": 1, "@max": this.opts.nameMax } } });
      case "POST /ISAPI/AccessControl/UserInfo/Record": {
        const info = parse().UserInfo;
        if (info.employeeNo === this.rejectEmployeeNo) return this.fail(res, 4, "badParameters", "employeeNo");
        if (this.users.has(info.employeeNo)) return this.fail(res, 6, "employeeNoAlreadyExist");
        if (Buffer.byteLength(info.name, "utf8") > this.opts.nameMax) return this.fail(res, 4, "badParameters", "name");
        this.users.set(info.employeeNo, { name: info.name, userType: info.userType, doorRight: info.doorRight });
        return this.ok(res);
      }
      case "PUT /ISAPI/AccessControl/UserInfo/Modify": {
        const info = parse().UserInfo;
        if (!this.users.has(info.employeeNo)) return this.fail(res, 6, "employeeNoNotExist");
        this.users.set(info.employeeNo, { name: info.name, userType: info.userType, doorRight: info.doorRight });
        return this.ok(res);
      }
      case "PUT /ISAPI/AccessControl/UserInfoDetail/Delete": {
        for (const { employeeNo } of parse().UserInfoDetail.EmployeeNoList) {
          this.users.delete(employeeNo);
          this.faces.delete(employeeNo);
        }
        return this.ok(res);
      }
      case "POST /ISAPI/Intelligent/FDLib/FaceDataRecord": {
        const boundary = /boundary=(.+)$/.exec(req.headers["content-type"] ?? "")?.[1];
        if (!boundary) return this.fail(res, 4, "badParameters", "multipart");
        const parts = splitMultipart(body, boundary);
        const meta = parts.find((p) => p.name === this.opts.faceJsonField);
        const image = parts.find((p) => p.name === this.opts.faceImageField);
        if (!meta || !image) return this.fail(res, 4, "badParameters", "part names");
        const info = JSON.parse(meta.data.toString("utf8"));
        const isJpeg = image.data[0] === 0xff && image.data[1] === 0xd8;
        if (!isJpeg || image.data.byteLength > 200 * 1024) return this.fail(res, 4, "badParameters", "picture");
        if (this.faces.has(info.FPID)) return this.fail(res, 6, "deviceUserAlreadyExistFace");
        this.faces.set(info.FPID, { meta: info, jpegBytes: image.data.byteLength, partNames: parts.map((p) => p.name), imageContentType: image.contentType });
        return this.ok(res);
      }
      case "PUT /ISAPI/Intelligent/FDLib/FDSearch/Delete": {
        for (const { value } of parse().FPID) this.faces.delete(value);
        return this.ok(res);
      }
      default:
        return this.fail(res, 4, "notSupport", route);
    }
  }
}

function splitMultipart(body: Buffer, boundary: string) {
  const out: { name: string; contentType: string; data: Buffer }[] = [];
  const text = body.toString("latin1");
  for (const section of text.split(`--${boundary}`)) {
    const sep = section.indexOf("\r\n\r\n");
    if (sep < 0) continue;
    const headers = section.slice(0, sep);
    const name = /name="([^"]+)"/.exec(headers)?.[1];
    if (!name) continue;
    const contentType = /Content-Type:\s*([^\r\n]+)/i.exec(headers)?.[1] ?? "";
    const data = Buffer.from(section.slice(sep + 4).replace(/\r\n$/, ""), "latin1");
    out.push({ name, contentType, data });
  }
  return out;
}
