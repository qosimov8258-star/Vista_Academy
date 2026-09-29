import { request } from "urllib";

/**
 * ISAPI javobidagi xato. Hikvision xato javobi:
 * { statusCode, statusString, subStatusCode, errorCode, errorMsg }
 * (statusCode 1 — muvaffaqiyat).
 */
export class IsapiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly statusCode?: number,
    readonly subStatusCode?: string,
    readonly errorMsg?: string,
  ) {
    super(message);
  }

  /** Qurilmaga umuman ulanib bo'lmadi (tarmoq) — buyruqning aybi emas */
  get network(): boolean {
    return this.httpStatus === 0;
  }

  /** ack'ga yoziladigan qisqa izoh */
  describe(): string {
    const parts = [
      this.httpStatus ? `HTTP ${this.httpStatus}` : null,
      this.statusCode !== undefined ? `statusCode ${this.statusCode}` : null,
      this.subStatusCode ? `subStatusCode ${this.subStatusCode}` : null,
      this.errorMsg ? `errorMsg ${this.errorMsg}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : this.message;
  }
}

export interface IsapiTarget {
  ip: string;
  port: number;
  username: string;
  password: string;
}

type IsapiStatus = { statusCode?: number; statusString?: string; subStatusCode?: string; errorCode?: number; errorMsg?: string };

/**
 * Qurilmaga Digest auth bilan ISAPI so'rovlari. Parol faqat `digestAuth`ga
 * beriladi — hech qayerga yozilmaydi.
 */
export class IsapiClient {
  constructor(
    private readonly target: IsapiTarget,
    private readonly timeoutMs = 15_000,
  ) {}

  get baseUrl(): string {
    return `http://${this.target.ip}:${this.target.port}`;
  }

  async json<T = unknown>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
    return this.send<T>(method, path, body === undefined ? undefined : { content: JSON.stringify(body), contentType: "application/json" });
  }

  /** Javob matnining o'zi (ba'zi endpointlar, masalan deviceInfo, XML qaytaradi). */
  async text(path: string): Promise<string> {
    let res;
    try {
      res = await request(`${this.baseUrl}${path}`, { method: "GET", digestAuth: `${this.target.username}:${this.target.password}`, dataType: "text", timeout: this.timeoutMs, followRedirect: false });
    } catch (err) {
      throw new IsapiError(`Qurilmaga ulanib bo'lmadi (${this.target.ip}:${this.target.port}): ${err instanceof Error ? err.message : String(err)}`, 0);
    }
    if (res.status >= 400) throw new IsapiError(`HTTP ${res.status}`, res.status);
    return String(res.data ?? "");
  }

  /** multipart/form-data — tana qo'lda yig'iladi (qism nomlari va turlari aniq bo'lsin). */
  async multipart<T = unknown>(method: "POST" | "PUT", path: string, content: Buffer, boundary: string): Promise<T> {
    return this.send<T>(method, path, { content, contentType: `multipart/form-data; boundary=${boundary}` });
  }

  private async send<T>(method: string, path: string, body?: { content: string | Buffer; contentType: string }): Promise<T> {
    let res;
    try {
      res = await request(`${this.baseUrl}${path}`, {
        method: method as "GET",
        digestAuth: `${this.target.username}:${this.target.password}`,
        ...(body ? { content: body.content, contentType: body.contentType } : {}),
        headers: { Accept: "application/json" },
        dataType: "text",
        timeout: this.timeoutMs,
        // Qayta yo'naltirish kerak emas — token/parol boshqa manzilga sizib ketmasin
        followRedirect: false,
      });
    } catch (err) {
      throw new IsapiError(`Qurilmaga ulanib bo'lmadi (${this.target.ip}:${this.target.port}): ${err instanceof Error ? err.message : String(err)}`, 0);
    }
    const text = String(res.data ?? "");
    let data: (T & IsapiStatus) | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Ba'zi xatolar XML ko'rinishida keladi — matnning o'zi xabar bo'ladi
    }
    if (res.status === 401) {
      throw new IsapiError("Qurilma login yoki paroli noto'g'ri (401)", 401);
    }
    const failedStatus = data && typeof data.statusCode === "number" && data.statusCode !== 1;
    if (res.status >= 400 || failedStatus) {
      throw new IsapiError(
        `ISAPI ${method} ${path.split("?")[0]} muvaffaqiyatsiz`,
        res.status,
        data?.statusCode,
        data?.subStatusCode,
        data?.errorMsg ?? (data ? undefined : text.slice(0, 200)),
      );
    }
    return (data ?? ({} as T)) as T;
  }
}
