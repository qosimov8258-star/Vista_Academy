/**
 * Sinovlar uchun soxta ERP (`/api/v1/agent/*`) — javoblar haqiqiy API kabi
 * `{ success, data }` qobig'ida. Tokenni tekshiradi.
 */
import http from "http";
import type { AddressInfo } from "net";
import type { AgentCommand, ErpEvent } from "../src/erp-client";

export class MockErp {
  readonly token = "hik_test_token_1234567890";
  device = { id: "dev-1", name: "Kirish terminali", model: "DS-K1T342MX", serialNumber: "SN1", ip: "127.0.0.1", port: 0, username: "admin", password: "Qurilma123", status: "ACTIVE" };
  timezone = "Asia/Tashkent";
  readonly received: ErpEvent[] = [];
  commands: AgentCommand[] = [];
  readonly acks: { id: string; success: boolean; error?: string }[] = [];
  readonly faces = new Map<string, Buffer>();
  /** true — /agent/events 503 qaytaradi (internet uzilgandek) */
  eventsDown = false;
  commandsFetched = 0;
  private server!: http.Server;
  port = 0;

  get url() {
    return `http://127.0.0.1:${this.port}/api/v1`;
  }

  async start() {
    this.server = http.createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    this.port = (this.server.address() as AddressInfo).port;
  }

  async stop() {
    this.server.closeAllConnections?.();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private send(res: http.ServerResponse, status: number, data: unknown) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: { message: String(data) } }));
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null;
    if (req.headers.authorization !== `Bearer ${this.token}`) return this.send(res, 401, "Agent tokeni noto'g'ri");
    const url = new URL(req.url ?? "/", "http://erp");
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (req.method === "GET" && path === "/agent/config") {
      return this.send(res, 200, { device: this.device, timezone: this.timezone, serverTime: new Date().toISOString() });
    }
    if (req.method === "POST" && path === "/agent/events") {
      if (this.eventsDown) return this.send(res, 503, "Service Unavailable");
      let inserted = 0;
      for (const e of body.events as ErpEvent[]) {
        if (!this.received.some((r) => r.serialNo === e.serialNo && r.eventTime === e.eventTime)) {
          this.received.push(e);
          inserted++;
        }
      }
      return this.send(res, 200, { received: body.events.length, inserted, attendanceUpdated: 0 });
    }
    if (req.method === "GET" && path === "/agent/commands") {
      this.commandsFetched++;
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const batch = this.commands.splice(0, limit);
      return this.send(res, 200, batch);
    }
    const ack = /^\/agent\/commands\/([^/]+)\/ack$/.exec(path);
    if (req.method === "POST" && ack) {
      this.acks.push({ id: ack[1], ...body });
      return this.send(res, 200, { id: ack[1], status: body.success ? "DONE" : "PENDING" });
    }
    const face = /^\/agent\/commands\/([^/]+)\/face$/.exec(path);
    if (req.method === "GET" && face) {
      const image = this.faces.get(face[1]);
      if (!image) return this.send(res, 404, "Xodimda surat yo'q");
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      return res.end(image);
    }
    return this.send(res, 404, `${req.method} ${path}`);
  }
}
