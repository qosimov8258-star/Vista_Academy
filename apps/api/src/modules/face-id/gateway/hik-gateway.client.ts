import { createHash, randomBytes } from "crypto";

/**
 * Hik Device Gateway (HikGateway) klienti — agentsiz ulanish.
 *
 * Gateway — Hikvision'ning tayyor dasturi: terminallar unga ISUP 5.0 orqali
 * O'ZI ulanadi (maktabda router sozlanmaydi, kompyuter kerak emas), biz esa
 * shu yerdan HTTP orqali odam va yuzlarni boshqaramiz. Har qurilma
 * so'rovida `devIndex` (gateway bergan UUID) ko'rsatiladi.
 *
 * Haqiqiy DS-K1T342EX (V4.39.180) da 2026-11-20 da tekshirilgan xulqlar:
 *   · odam bor bo'lsa `UserInfo/Record` → `employeeNoAlreadyExist` → `Modify`
 *   · yuz `FDLib/FDSetUp` (`FDID`/`FPID` + `img`) bilan qo'yiladi — yangi
 *     odamga ham, almashtirishga ham bir xil ishlaydi
 *     (`FaceDataRecord` ikkinchi marta `deviceUserAlreadyExistFace` beradi)
 *   · yaroqsiz rasm → `SubpicAnalysisModelingError`
 *   · hodisa manzili (httpHosts) faqat terminalning o'z XML'i bilan o'tadi;
 *     gateway'ning JSON ko'rinishi `badParameters` qaytaradi
 *
 * Autentifikatsiya — HTTP Digest (MD5, qop=auth).
 */

export interface HikGwConfig {
  baseUrl: string;
  username: string;
  password: string;
}

/** Muhit o'zgaruvchilaridan; sozlanmagan bo'lsa `null` — gateway rejimi o'chiq */
export function hikGwConfig(env: NodeJS.ProcessEnv = process.env): HikGwConfig | null {
  const baseUrl = (env.FACE_ID_GATEWAY_URL ?? "").trim().replace(/\/+$/, "");
  const password = env.FACE_ID_GATEWAY_PASSWORD ?? "";
  if (!baseUrl || !password) return null;
  return { baseUrl, username: (env.FACE_ID_GATEWAY_USER ?? "").trim() || "admin", password };
}

export class HikGwError extends Error {
  constructor(
    /** Gateway/terminal `subStatusCode` yoki o'zimizniki: `network`, `timeout`, `auth`, `http` */
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  /** Vaqtinchalik: navbat PENDING qoladi, keyingi aylanishda qayta uriniladi */
  get transient(): boolean {
    return ["network", "timeout", "theDeviceIsOffline", "deviceBusy", "http"].includes(this.code);
  }
}

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

/** `WWW-Authenticate: Digest realm="…", nonce="…", qop="auth"` → maydonlar */
export function parseDigestChallenge(header: string | null): Record<string, string> | null {
  if (!header || !/^\s*digest\s/i.test(header)) return null;
  const out: Record<string, string> = {};
  const re = /([a-z]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/gi;
  for (let m = re.exec(header); m; m = re.exec(header)) out[m[1].toLowerCase()] = m[2] ?? m[3];
  return out.nonce && out.realm !== undefined ? out : null;
}

/** RFC 2617 javobi. `uri` — yo'l va so'rov qatori (`/ISAPI/…?devIndex=…`) */
export function digestAuthorization(p: {
  challenge: Record<string, string>;
  method: string;
  uri: string;
  username: string;
  password: string;
  nc: number;
  cnonce: string;
}): string {
  const { realm, nonce, opaque } = p.challenge;
  const qop = (p.challenge.qop ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes("auth")
    ? "auth"
    : "";
  const ha1 = md5(`${p.username}:${realm}:${p.password}`);
  const ha2 = md5(`${p.method}:${p.uri}`);
  const nc = p.nc.toString(16).padStart(8, "0");
  const response = qop ? md5(`${ha1}:${nonce}:${nc}:${p.cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${nonce}:${ha2}`);
  const parts = [`username="${p.username}"`, `realm="${realm}"`, `nonce="${nonce}"`, `uri="${p.uri}"`, `response="${response}"`];
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${p.cnonce}"`);
  if (opaque) parts.push(`opaque="${opaque}"`);
  return `Digest ${parts.join(", ")}`;
}

export interface HikGwDevice {
  devIndex: string;
  /** ISUP «Device ID» — bizda `FaceIdDevice.isupDeviceId` */
  ehomeId: string;
  name: string;
  online: boolean;
  model: string | null;
  version: string | null;
  /** 0 — ulanishni kutmoqda, 1 — kalit noto'g'ri, 2 — ISUP versiyasi mos emas, 3 — tarmoq */
  offlineHint: number | null;
}

type Body = { kind: "json"; value: unknown } | { kind: "xml"; value: string } | { kind: "multipart"; boundary: string; content: Buffer };

const VALID = { enable: false, beginTime: "2020-01-01T00:00:00", endTime: "2037-12-31T23:59:59" };
const ACCESS = { doorRight: "1", RightPlan: [{ doorNo: 1, planTemplateNo: "1" }] };

export class HikGwClient {
  private challenge: Record<string, string> | null = null;
  private nc = 0;

  constructor(
    private readonly cfg: HikGwConfig,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 30_000,
  ) {}

  // ───────────────────────────── Transport ─────────────────────────────

  private async send(method: string, uri: string, body: Body | undefined, auth: string | null): Promise<Response> {
    const headers: Record<string, string> = {};
    let payload: BodyInit | undefined;
    if (body?.kind === "json") {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body.value);
    } else if (body?.kind === "xml") {
      headers["Content-Type"] = "application/xml";
      payload = body.value;
    } else if (body?.kind === "multipart") {
      headers["Content-Type"] = `multipart/form-data; boundary=${body.boundary}`;
      payload = new Uint8Array(body.content);
    }
    if (auth) headers.Authorization = auth;
    try {
      return await this.fetchImpl(`${this.cfg.baseUrl}${uri}`, {
        method,
        headers,
        body: payload,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "TimeoutError" || name === "AbortError") throw new HikGwError("timeout", "Gateway javob bermadi");
      throw new HikGwError("network", `Gateway bilan aloqa yo'q: ${(err as Error)?.message ?? err}`);
    }
  }

  private authFor(method: string, uri: string): string | null {
    if (!this.challenge) return null;
    this.nc += 1;
    return digestAuthorization({
      challenge: this.challenge,
      method,
      uri,
      username: this.cfg.username,
      password: this.cfg.password,
      nc: this.nc,
      cnonce: randomBytes(8).toString("hex"),
    });
  }

  /** So'rov + Digest: birinchi javob 401 bo'lsa (yoki nonce eskirsa) bir marta qayta yuboriladi */
  private async request(method: string, uri: string, body?: Body): Promise<string> {
    let res = await this.send(method, uri, body, this.authFor(method, uri));
    if (res.status === 401) {
      const ch = parseDigestChallenge(res.headers.get("www-authenticate"));
      if (!ch) throw new HikGwError("auth", "Gateway autentifikatsiya so‘ramadi (Digest kutilgan)");
      this.challenge = ch;
      this.nc = 0;
      res = await this.send(method, uri, body, this.authFor(method, uri));
      if (res.status === 401) throw new HikGwError("auth", "Gateway login yoki paroli noto‘g‘ri");
    }
    const text = await res.text();
    if (res.status >= 500) throw new HikGwError("http", `Gateway xatosi (HTTP ${res.status})`);
    return text;
  }

  /** JSON javob; `statusCode` 1 dan boshqa bo'lsa — xato (`subStatusCode` kod sifatida) */
  private async json<T = any>(method: string, uri: string, body?: Body): Promise<T> {
    const text = await this.request(method, uri, body);
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new HikGwError("badResponse", `Gateway kutilmagan javob qaytardi: ${text.slice(0, 120)}`);
    }
    failIfError(data);
    return data as T;
  }

  // ───────────────────────────── Qurilmalar ─────────────────────────────

  async devices(): Promise<HikGwDevice[]> {
    const out: HikGwDevice[] = [];
    for (let position = 0; ; position += 100) {
      const data = await this.json("POST", "/ISAPI/ContentMgmt/DeviceMgmt/deviceList?format=json", {
        kind: "json",
        value: {
          SearchDescription: { position, maxResult: 100, Filter: { key: "", devType: "", protocolType: ["ehomeV5"], devStatus: ["online", "offline"] } },
        },
      });
      const list: any[] = data?.SearchResult?.MatchList ?? [];
      for (const { Device: d } of list) {
        if (!d?.devIndex) continue;
        out.push({
          devIndex: String(d.devIndex),
          ehomeId: String(d.EhomeParams?.EhomeID ?? ""),
          name: String(d.devName ?? ""),
          online: d.devStatus === "online",
          model: d.devMode || null,
          version: d.devVersion || null,
          offlineHint: typeof d.offlineHint === "number" ? d.offlineHint : null,
        });
      }
      const total = Number(data?.SearchResult?.totalMatches ?? 0);
      if (!list.length || position + list.length >= total) return out;
    }
  }

  /** Qurilmani gateway'ga qo'shadi; terminal shu ID va kalit bilan ulanadi */
  async addDevice(ehomeId: string, ehomeKey: string, name: string): Promise<string> {
    const data = await this.json("POST", "/ISAPI/ContentMgmt/DeviceMgmt/addDevice?format=json", {
      kind: "json",
      value: {
        DeviceInList: [
          { Device: { protocolType: "ehomeV5", EhomeParams: { EhomeID: ehomeId, EhomeKey: ehomeKey }, devName: name.slice(0, 32), devType: "AccessControl" } },
        ],
      },
    });
    const d = data?.DeviceOutList?.[0]?.Device;
    if (!d?.devIndex || d.status !== "success") throw new HikGwError(String(d?.status ?? "addFailed"), "Qurilmani gateway'ga qo'shib bo'lmadi");
    return String(d.devIndex);
  }

  /**
   * Gateway'dagi qurilma kalitini almashtiradi. Kalit bo'yicha haqiqat manbai —
   * ERP: admin kartada ko'rgan kalit terminalga kiritiladigan kalit bilan
   * doim bir xil bo'lishi kerak (gateway kalitni qaytarib bermaydi).
   */
  async setDeviceKey(devIndex: string, ehomeId: string, ehomeKey: string, name: string): Promise<void> {
    await this.json("PUT", "/ISAPI/ContentMgmt/DeviceMgmt/modDevice?format=json", {
      kind: "json",
      value: { DeviceInfo: { devIndex, protocolType: "ehomeV5", EhomeParams: { EhomeID: ehomeId, EhomeKey: ehomeKey }, devName: name.slice(0, 32) } },
    });
  }

  async deleteDevice(devIndex: string): Promise<void> {
    await this.json("POST", "/ISAPI/ContentMgmt/DeviceMgmt/delDevice?format=json", { kind: "json", value: { DevIndexList: [devIndex] } });
  }

  // ───────────────────────────── Odam va yuz ─────────────────────────────

  /** Odamni qo'shadi; allaqachon bo'lsa ismini yangilaydi */
  async upsertPerson(devIndex: string, employeeNo: string, name: string): Promise<void> {
    const person = { employeeNo, name: name.slice(0, 32), userType: "normal", Valid: VALID, ...ACCESS };
    const q = `format=json&devIndex=${encodeURIComponent(devIndex)}`;
    try {
      const data = await this.json("POST", `/ISAPI/AccessControl/UserInfo/Record?${q}`, { kind: "json", value: { UserInfo: [person] } });
      failIfError(data?.UserInfoOutList?.UserInfoOut?.[0]);
    } catch (err) {
      if (!(err instanceof HikGwError) || err.code !== "employeeNoAlreadyExist") throw err;
      await this.json("PUT", `/ISAPI/AccessControl/UserInfo/Modify?${q}`, { kind: "json", value: { UserInfo: person } });
    }
  }

  /** Odamning yuzini qo'yadi yoki almashtiradi (JPEG) */
  async setFace(devIndex: string, employeeNo: string, jpeg: Buffer): Promise<void> {
    await this.json("PUT", `/ISAPI/Intelligent/FDLib/FDSetUp?format=json&devIndex=${encodeURIComponent(devIndex)}`, {
      kind: "multipart",
      ...faceMultipart(employeeNo, jpeg),
    });
  }

  /** Odamni yuzi va kartasi bilan o'chiradi; terminalda yo'q bo'lsa ham xato emas */
  async removePerson(devIndex: string, employeeNo: string): Promise<void> {
    await this.json("PUT", `/ISAPI/AccessControl/UserInfoDetail/Delete?format=json&devIndex=${encodeURIComponent(devIndex)}`, {
      kind: "json",
      value: { UserInfoDetail: { mode: "byEmployeeNo", EmployeeNoList: [{ employeeNo }] } },
    });
  }

  // ───────────────────────────── Hodisalar ─────────────────────────────

  /**
   * Terminal xotirasidagi kirish hodisalari (ISAPI `AcsEvent`, major 5) —
   * agent lokal tarmoqda o'qigan narsaning o'zi, faqat gateway orqali.
   * `more` — yana sahifa bor (`position` ni oshirib davom etiladi).
   */
  async searchEvents(
    devIndex: string,
    q: { startTime: string; endTime: string; position: number; maxResults?: number },
  ): Promise<{ events: Record<string, unknown>[]; more: boolean; total: number }> {
    const data = await this.json("POST", `/ISAPI/AccessControl/AcsEvent?format=json&devIndex=${encodeURIComponent(devIndex)}`, {
      kind: "json",
      value: {
        AcsEventCond: {
          searchID: randomBytes(8).toString("hex"),
          searchResultPosition: q.position,
          maxResults: q.maxResults ?? 30,
          major: 5,
          minor: 0,
          startTime: q.startTime,
          endTime: q.endTime,
        },
      },
    });
    const acs = data?.AcsEvent ?? {};
    const events: Record<string, unknown>[] = Array.isArray(acs.InfoList) ? acs.InfoList : Array.isArray(acs.MatchList) ? acs.MatchList : [];
    return { events, more: acs.responseStatusStrg === "MORE", total: Number(acs.totalMatches ?? events.length) };
  }

  // ───────────────────────────── Hodisa manzili ─────────────────────────────

  /**
   * Terminal hodisalarni shu manzilga O'ZI yuboradi (ixtiyoriy yo'l —
   * asosiy yo'lda server hodisalarni `searchEvents` bilan o'zi o'qiydi).
   * Faqat oddiy HTTP va IP: terminal Let's Encrypt sertifikati bilan HTTPS
   * ulanishni o'rnatolmadi.
   */
  async setEventHost(devIndex: string, host: { ip: string; port: number; url: string }): Promise<void> {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<HttpHostNotification version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">' +
      `<id>1</id><url>${escapeXml(host.url)}</url><protocolType>HTTP</protocolType>` +
      "<parameterFormatType>JSON</parameterFormatType><addressingFormatType>ipaddress</addressingFormatType>" +
      `<ipAddress>${escapeXml(host.ip)}</ipAddress><portNo>${host.port}</portNo>` +
      "<httpAuthenticationMethod>none</httpAuthenticationMethod></HttpHostNotification>";
    const text = await this.request("PUT", `/ISAPI/Event/notification/httpHosts/1?devIndex=${encodeURIComponent(devIndex)}`, { kind: "xml", value: xml });
    const code = /<statusCode>\s*(\d+)\s*<\/statusCode>/.exec(text)?.[1];
    if (code === "1") return;
    // Terminal offline bo'lsa gateway JSON bilan javob beradi
    try {
      failIfError(JSON.parse(text));
    } catch (err) {
      if (err instanceof HikGwError) throw err;
    }
    const sub = /<subStatusCode>\s*([^<]*)<\/subStatusCode>/.exec(text)?.[1]?.trim();
    throw new HikGwError(sub || "badResponse", `Hodisa manzilini sozlab bo'lmadi: ${text.slice(0, 120)}`);
  }
}

/**
 * Yuz so'rovining tanasi: JSON qism + JPEG. Qo'lda yig'iladi — `FormData`ga
 * Blob qo'shilsa, JSON qism ham fayl bo'lib ketadi (`filename="blob"`) va
 * terminal uni o'qiy olmay «Invalid JSON format» qaytaradi. JSON qismda fayl
 * nomi bo'lmasligi shart; hik-agent ham shu ko'rinishda yuboradi.
 */
export function faceMultipart(employeeNo: string, jpeg: Buffer, boundary = `----zeeron${randomBytes(12).toString("hex")}`) {
  const json = JSON.stringify({ faceLibType: "blackFD", FDID: "1", FPID: employeeNo });
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="FaceDataRecord"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${json}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="img"; filename="face.jpg"\r\n` +
    `Content-Type: image/jpeg\r\n\r\n`;
  return { boundary, content: Buffer.concat([Buffer.from(head, "utf8"), jpeg, Buffer.from(`\r\n--${boundary}--\r\n`, "utf8")]) };
}

/** Gateway/terminal javobidagi xatoni istisnoga aylantiradi */
function failIfError(data: any): void {
  if (!data || typeof data !== "object") return;
  const status = data.statusCode;
  if (status === undefined || status === 1 || status === "1") return;
  const code = String(data.subStatusCode || data.statusString || "error");
  throw new HikGwError(code, String(data.errorMsg || data.statusString || code));
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);

/** Buyruq xatosi — admin tushunadigan matn */
export function faceSyncErrorText(err: unknown): string {
  const code = err instanceof HikGwError ? err.code : "";
  const known: Record<string, string> = {
    SubpicAnalysisModelingError: "Rasmda yuz aniqlanmadi yoki sifati past — boshqa rasm qo‘ying",
    faceDataPDFailed: "Rasmda yuz aniqlanmadi — boshqa rasm qo‘ying",
    picFormatError: "Rasm formati mos emas (JPG kerak)",
    picSizeError: "Rasm hajmi juda katta",
    deviceUserAlreadyExistFace: "Terminalda bu odamning yuzi bor, almashtirib bo‘lmadi",
    fullUserNumber: "Terminal xotirasi to‘la (odamlar soni chegarada)",
    fullFaceNumber: "Terminal xotirasi to‘la (yuzlar soni chegarada)",
    photo: "Rasmni yuklab bo‘lmadi",
    photoType: "Rasm JPG formatida bo‘lishi kerak",
  };
  if (known[code]) return known[code];
  return (err as Error)?.message?.slice(0, 200) || "Xato";
}
