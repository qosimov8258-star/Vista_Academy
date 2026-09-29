import { randomUUID, randomBytes } from "crypto";
import sharp from "sharp";
import type { IsapiOptions } from "./config";
import type { ErpEvent } from "./erp-client";
import { IsapiClient, IsapiError } from "./isapi-client";

/**
 * Hikvision ISAPI amallari. Endpointlar Hikvision ISAPI hujjatiga ko'ra;
 * proshivkaga qarab farq qilishi mumkin bo'lgan joylar (multipart qism
 * nomlari, yuz kutubxonasi) `.env` orqali sozlanadi — README'ga qarang.
 */

/** Voqea sahifasi hajmi (ISAPI maxResults) */
const PAGE_SIZE = 30;
/** Bitta qidiruvda ko'pi bilan shuncha sahifa — cheksiz aylanib qolmaslik uchun */
const MAX_PAGES = 200;

/** AcsEvent javobidagi bitta voqea (faqat biz ishlatadigan maydonlar). */
interface AcsEventInfo {
  major: number;
  minor: number;
  time: string;
  serialNo?: number;
  employeeNoString?: string;
  currentVerifyMode?: string;
  pictureURL?: string;
  [key: string]: unknown;
}

interface AcsEventResponse {
  AcsEvent?: {
    searchID?: string;
    responseStatusStrg?: "OK" | "MORE" | "NO MATCH" | string;
    numOfMatches?: number;
    totalMatches?: number;
    InfoList?: AcsEventInfo[];
  };
}

/**
 * Berilgan oraliqdagi kirish voqealari (major 5 — "Event"). `MORE` bo'lsa
 * sahifalab davom etadi. Faqat `employeeNoString` bor (ya'ni odam
 * aniqlangan) voqealar qaytariladi.
 */
export async function searchEvents(client: IsapiClient, startTime: string, endTime: string): Promise<ErpEvent[]> {
  const searchID = randomUUID();
  const out: ErpEvent[] = [];
  let position = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await client.json<AcsEventResponse>("POST", "/ISAPI/AccessControl/AcsEvent?format=json", {
      AcsEventCond: { searchID, searchResultPosition: position, maxResults: PAGE_SIZE, major: 5, minor: 0, startTime, endTime },
    });
    const block = res.AcsEvent ?? {};
    const list = block.InfoList ?? [];
    for (const info of list) {
      if (!info.employeeNoString || typeof info.serialNo !== "number") continue;
      out.push({
        serialNo: info.serialNo,
        employeeNo: info.employeeNoString,
        eventTime: info.time,
        major: info.major,
        minor: info.minor,
        verifyMode: info.currentVerifyMode,
        pictureUrl: info.pictureURL,
        raw: info,
      });
    }
    const got = block.numOfMatches ?? list.length;
    position += got;
    if (block.responseStatusStrg !== "MORE" || got === 0) break;
  }
  return out;
}

/** UTF-8 baytlari bo'yicha xavfsiz qisqartirish (harf o'rtasidan kesilmasin). */
export function truncateUtf8(text: string, maxBytes: number): string {
  let out = "";
  for (const ch of text) {
    if (Buffer.byteLength(out + ch, "utf8") > maxBytes) break;
    out += ch;
  }
  return out.trim();
}

/** Xodim ismining qurilmadagi maksimal uzunligi — UserInfo capabilities'dan. */
export async function readNameMaxBytes(client: IsapiClient): Promise<number | null> {
  try {
    const caps = await client.json<{ UserInfo?: { name?: { "@max"?: number } } }>("GET", "/ISAPI/AccessControl/UserInfo/capabilities?format=json");
    const max = caps.UserInfo?.name?.["@max"];
    return typeof max === "number" && max > 0 ? max : null;
  } catch {
    return null;
  }
}

function isAlreadyExists(err: unknown): boolean {
  return err instanceof IsapiError && /alreadyexist/i.test(`${err.subStatusCode ?? ""} ${err.errorMsg ?? ""}`);
}

/**
 * Xodimni qurilmaga qo'shadi; allaqachon bo'lsa — o'zgartiradi (Modify).
 */
export async function addOrUpdateUser(client: IsapiClient, opts: IsapiOptions & { nameMaxBytes: number }, user: { employeeNo: string; name: string }) {
  const body = {
    UserInfo: {
      employeeNo: user.employeeNo,
      name: truncateUtf8(user.name, opts.nameMaxBytes) || user.employeeNo,
      userType: "normal",
      Valid: { enable: true, beginTime: "2020-01-01T00:00:00", endTime: opts.userValidEnd, timeType: "local" },
      doorRight: "1",
      RightPlan: [{ doorNo: 1, planTemplateNo: "1" }],
    },
  };
  try {
    await client.json("POST", "/ISAPI/AccessControl/UserInfo/Record?format=json", body);
    return "created" as const;
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
  }
  await client.json("PUT", "/ISAPI/AccessControl/UserInfo/Modify?format=json", body);
  return "modified" as const;
}

/**
 * Foydalanuvchini qurilmadan o'chiradi (yuz ma'lumoti ham u bilan birga
 * ketadi). DS-K1T342EX (V4.39) da o'chirish fonda bajariladi: so'rov darhol
 * "OK" qaytaradi, natijani esa `DeleteProcess` ko'rsatadi — shuni kutamiz,
 * aks holda ERP'ga "bajarildi" deb erta aytib qo'yardik.
 */
export async function deleteUser(client: IsapiClient, employeeNo: string, opts: { pollMs?: number; timeoutMs?: number } = {}) {
  await client.json("PUT", "/ISAPI/AccessControl/UserInfoDetail/Delete?format=json", {
    UserInfoDetail: { mode: "byEmployeeNo", EmployeeNoList: [{ employeeNo }] },
  });
  const pollMs = opts.pollMs ?? 500;
  const deadline = Date.now() + (opts.timeoutMs ?? 20_000);
  while (Date.now() < deadline) {
    let status: string | undefined;
    try {
      const res = await client.json<{ UserInfoDetailDeleteProcess?: { status?: string } }>(
        "GET",
        "/ISAPI/AccessControl/UserInfoDetail/DeleteProcess?format=json",
      );
      status = res.UserInfoDetailDeleteProcess?.status;
    } catch (err) {
      // Eski proshivkada bu endpoint yo'q — o'chirish sinxron bo'lgan
      if (err instanceof IsapiError && !err.network) return;
      throw err;
    }
    if (status === "success" || status === undefined) return;
    if (status === "failed") throw new IsapiError("O'chirish muvaffaqiyatsiz (DeleteProcess: failed)", 200);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new IsapiError("O'chirish tugashini kutish vaqti o'tdi (DeleteProcess)", 200);
}

/**
 * Rasmni qurilma qabul qiladigan hajmga keltiradi: JPEG, ≤ maxBytes.
 * Avval sifat, keyin o'lcham kamaytiriladi.
 */
export async function prepareFaceJpeg(input: Buffer, maxBytes: number): Promise<Buffer> {
  let size = 640;
  let quality = 85;
  for (let i = 0; i < 12; i++) {
    const out = await sharp(input).rotate().resize(size, size, { fit: "inside", withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.byteLength <= maxBytes) return out;
    if (quality > 55) quality -= 10;
    else size = Math.round(size * 0.8);
  }
  throw new Error(`Rasmni ${maxBytes} baytgacha kichraytirib bo'lmadi`);
}

/** multipart/form-data tanasi: JSON qism + JPEG. */
export function buildFaceMultipart(opts: IsapiOptions, employeeNo: string, jpeg: Buffer) {
  const boundary = `----hikagent${randomBytes(12).toString("hex")}`;
  const json = JSON.stringify({ faceLibType: opts.faceLibType, FDID: opts.faceFdid, FPID: employeeNo });
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${opts.faceJsonField}"\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${json}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${opts.faceImageField}"; filename="face.jpg"\r\n` +
    `Content-Type: image/jpeg\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  return { boundary, body: Buffer.concat([Buffer.from(head, "utf8"), jpeg, Buffer.from(tail, "utf8")]) };
}

/** Yuzni kutubxonadan o'chirish (qayta yuklashdan oldin). */
export async function deleteFace(client: IsapiClient, opts: IsapiOptions, employeeNo: string) {
  await client.json(
    "PUT",
    `/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=${encodeURIComponent(opts.faceFdid)}&faceLibType=${encodeURIComponent(opts.faceLibType)}`,
    { FPID: [{ value: employeeNo }] },
  );
}

/**
 * Xodim yuzini yuklaydi. Yuz allaqachon bo'lsa — avval o'chirib, qayta
 * yuklaydi (proshivkalar orasida eng keng tarqalgan yo'l).
 */
export async function setFace(client: IsapiClient, opts: IsapiOptions, employeeNo: string, image: Buffer) {
  const jpeg = await prepareFaceJpeg(image, opts.faceMaxBytes);
  const upload = () => {
    const { boundary, body } = buildFaceMultipart(opts, employeeNo, jpeg);
    return client.multipart("POST", "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json", body, boundary);
  };
  try {
    await upload();
    return { replaced: false, bytes: jpeg.byteLength };
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
  }
  await deleteFace(client, opts, employeeNo);
  await upload();
  return { replaced: true, bytes: jpeg.byteLength };
}
