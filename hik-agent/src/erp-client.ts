import { request } from "urllib";

/** ERP'dan kelgan qurilma sozlamalari (`GET /agent/config`). */
export interface DeviceConfig {
  device: {
    id: string;
    name: string;
    model: string;
    serialNumber: string | null;
    ip: string | null;
    port: number;
    username: string | null;
    password: string | null;
    status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  };
  timezone: string;
  serverTime: string;
}

export type CommandType = "ADD_OR_UPDATE_USER" | "SET_FACE" | "DELETE_USER";

export interface AgentCommand {
  id: string;
  type: CommandType;
  employeeNo: string;
  payload: { employeeNo: string; name?: string; avatarUpdatedAt?: string };
  attempts: number;
}

export interface ErpEvent {
  serialNo: number;
  employeeNo?: string;
  eventTime: string;
  major: number;
  minor: number;
  verifyMode?: string;
  pictureUrl?: string;
  raw: Record<string, unknown>;
}

export class ErpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
  /** Tarmoq yoki server (5xx) xatosi — keyinroq qayta urinish kerak */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
}

/**
 * ERP (`/agent/*`) bilan ishlash. Har bir qurilmaning o'z tokeni bor.
 * Javoblar `{ success, data }` qobig'ida keladi.
 */
export class ErpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly timeoutMs = 20_000,
    /** Ulangan agent (hka_ kaliti) — qaysi qurilma nomidan so'ralayotgani */
    private readonly deviceId?: string,
  ) {}

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      ...(this.deviceId ? { "X-Face-Id-Device": this.deviceId } : {}),
    };
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let res;
    try {
      res = await request(`${this.baseUrl}${path}`, {
        method,
        headers: { ...this.authHeaders(), Accept: "application/json" },
        ...(body !== undefined ? { content: JSON.stringify(body), contentType: "application/json" } : {}),
        dataType: "json",
        timeout: this.timeoutMs,
        // Qayta yo'naltirish kerak emas — token/parol boshqa manzilga sizib ketmasin
        followRedirect: false,
      });
    } catch (err) {
      throw new ErpError(`ERP'ga ulanib bo'lmadi: ${err instanceof Error ? err.message : String(err)}`, 0);
    }
    const payload = res.data as { success?: boolean; data?: T; error?: { message?: string } } | null;
    if (res.status >= 400 || !payload?.success) {
      throw new ErpError(`ERP ${method} ${path} → ${res.status}: ${payload?.error?.message ?? "noma'lum xato"}`, res.status);
    }
    return payload.data as T;
  }

  config() {
    return this.call<DeviceConfig>("GET", "/agent/config");
  }

  sendEvents(events: ErpEvent[]) {
    return this.call<{ received: number; inserted: number; attendanceUpdated: number }>("POST", "/agent/events", { events });
  }

  commands(limit = 10) {
    return this.call<AgentCommand[]>("GET", `/agent/commands?limit=${limit}`);
  }

  ack(commandId: string, success: boolean, error?: string) {
    return this.call<{ id: string; status: string }>("POST", `/agent/commands/${commandId}/ack`, { success, ...(error ? { error } : {}) });
  }

  /** SET_FACE uchun xodim surati (binar). */
  async faceImage(commandId: string): Promise<Buffer> {
    let res;
    try {
      res = await request(`${this.baseUrl}/agent/commands/${commandId}/face`, {
        method: "GET",
        headers: this.authHeaders(),
        dataType: "buffer",
        timeout: this.timeoutMs,
        // Qayta yo'naltirish kerak emas — token/parol boshqa manzilga sizib ketmasin
        followRedirect: false,
      });
    } catch (err) {
      throw new ErpError(`ERP'ga ulanib bo'lmadi: ${err instanceof Error ? err.message : String(err)}`, 0);
    }
    if (res.status >= 400) {
      throw new ErpError(`Suratni olib bo'lmadi (${res.status})`, res.status);
    }
    return res.data as Buffer;
  }
}
