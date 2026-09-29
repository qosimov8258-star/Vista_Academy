import type { AgentConfig } from "./config";
import { ErpClient, ErpError, type AgentCommand, type DeviceConfig, type ErpEvent } from "./erp-client";
import { IsapiClient, IsapiError } from "./isapi-client";
import { addOrUpdateUser, deleteUser, readNameMaxBytes, searchEvents, setFace } from "./isapi";
import { Backoff, sleep } from "./backoff";
import { createLogger, errorText, type Logger } from "./logger";
import { deviceFiles } from "./state-store";
import { isapiTime } from "./time";

/** Voqealar ERP'ga shuncha-shunchadan yuboriladi */
const EVENT_BATCH = 100;
/** Oldingi oraliq bilan ustma-ust olish (qurilma soati biroz orqada bo'lsa voqea tushib qolmasin) */
const OVERLAP_MS = 2 * 60_000;
/** Qurilma sozlamalari ERP'dan shu oraliqda yangilanadi */
const CONFIG_REFRESH_MS = 5 * 60_000;
/** Internet uzoq uzilsa navbat cheksiz o'smasin */
const MAX_QUEUE = 50_000;
const DEFAULT_NAME_MAX_BYTES = 32;
const COMMANDS_PER_TICK = 10;

/**
 * Bitta qurilma (bitta agent tokeni) uchun ishchi:
 *  1) navbatdagi voqealarni ERP'ga yuboradi;
 *  2) qurilmadan yangi voqealarni o'qib, avval lokal navbatga yozadi;
 *  3) ERP'dagi buyruqlarni qurilmada bajarib, natijani qaytaradi.
 * Qurilma yoki ERP ulanmasa — har biri uchun alohida exponential backoff.
 */
export class DeviceWorker {
  private readonly erp: ErpClient;
  private log: Logger;
  private config: DeviceConfig | null = null;
  private configLoadedAt = 0;
  private isapi: IsapiClient | null = null;
  private nameMaxBytes: number | null = null;
  private files: ReturnType<typeof deviceFiles> | null = null;
  private readonly deviceBackoff = new Backoff();
  private readonly erpBackoff = new Backoff();
  private deviceRetryAt = 0;
  private erpRetryAt = 0;
  private stopped = false;
  private warnedNotConfigured = false;

  constructor(
    token: string,
    private readonly cfg: AgentConfig,
    private readonly now: () => number = Date.now,
  ) {
    this.erp = new ErpClient(cfg.erpUrl, token);
    this.log = createLogger("agent");
  }

  async run(): Promise<void> {
    while (!this.stopped) {
      await this.tick();
      await sleep(this.cfg.pollIntervalMs);
    }
  }

  stop() {
    this.stopped = true;
  }

  /** Bitta aylanish — sinovlarda ham to'g'ridan-to'g'ri chaqiriladi. */
  async tick(): Promise<void> {
    try {
      if (!(await this.ensureConfig())) return;
      await this.flushQueue();
      await this.pollEvents();
      await this.processCommands();
    } catch (err) {
      this.log.error(`Kutilmagan xato: ${errorText(err)}`);
    }
  }

  // -------------------------------------------------------------------

  private async ensureConfig(): Promise<boolean> {
    const stale = this.now() - this.configLoadedAt > CONFIG_REFRESH_MS;
    if (this.config && !stale) return this.ready();
    if (this.now() < this.erpRetryAt) return this.config ? this.ready() : false;
    try {
      const config = await this.erp.config();
      const d = config.device;
      const changed =
        !this.config || d.ip !== this.config.device.ip || d.port !== this.config.device.port || d.username !== this.config.device.username || d.password !== this.config.device.password;
      this.config = config;
      this.configLoadedAt = this.now();
      this.erpSucceeded();
      this.log = createLogger(d.name);
      this.files ??= deviceFiles(this.cfg.dataDir, d.id);
      if (changed) {
        this.isapi = d.ip && d.username && d.password ? new IsapiClient({ ip: d.ip, port: d.port, username: d.username, password: d.password }) : null;
        this.nameMaxBytes = null;
        this.log.info(`Sozlamalar olindi: ${d.ip ?? "IP yo'q"}:${d.port}, model ${d.model}`);
      }
      return this.ready();
    } catch (err) {
      this.erpFailed(err);
      return this.config ? this.ready() : false;
    }
  }

  private ready(): boolean {
    const d = this.config!.device;
    if (d.status === "INACTIVE") return false;
    if (!this.isapi) {
      if (!this.warnedNotConfigured) {
        this.log.warn("Qurilmaning IP, login yoki paroli ERP'da kiritilmagan — kutyapman");
        this.warnedNotConfigured = true;
      }
      return false;
    }
    this.warnedNotConfigured = false;
    return true;
  }

  // --- Voqealar --------------------------------------------------------

  private async flushQueue(): Promise<void> {
    if (this.now() < this.erpRetryAt) return;
    const files = this.files!;
    let queue = (await files.queue.read()) as ErpEvent[];
    while (queue.length > 0) {
      const batch = queue.slice(0, EVENT_BATCH);
      try {
        const result = await this.erp.sendEvents(batch);
        this.erpSucceeded();
        if (result.inserted > 0) this.log.info(`ERP'ga ${result.inserted} ta yangi voqea yozildi (${batch.length} yuborildi)`);
      } catch (err) {
        if (err instanceof ErpError && !err.retryable) {
          // Qayta yuborish foyda bermaydi (masalan 400) — alohida faylga, navbat to'xtab qolmasin
          this.log.error(`ERP voqealarni rad etdi, ${batch.length} ta voqea rejected faylga: ${err.message}`);
          await files.rejected.append({ at: new Date(this.now()).toISOString(), error: err.message, events: batch });
        } else {
          this.erpFailed(err);
          return;
        }
      }
      queue = queue.slice(batch.length);
      await files.queue.write(queue);
    }
  }

  private async pollEvents(): Promise<void> {
    if (this.now() < this.deviceRetryAt) return;
    const files = this.files!;
    const state = await files.state.read();
    const end = new Date(this.now());
    const start = state.lastSyncedTo
      ? new Date(new Date(state.lastSyncedTo).getTime() - OVERLAP_MS)
      : new Date(end.getTime() - this.cfg.initialLookbackHours * 3_600_000);
    const tz = this.config!.timezone;
    let events: ErpEvent[];
    try {
      events = await searchEvents(this.isapi!, isapiTime(start, tz), isapiTime(end, tz));
      this.deviceSucceeded();
    } catch (err) {
      this.deviceFailed(err);
      return;
    }
    if (events.length > 0) {
      let queue = [...((await files.queue.read()) as ErpEvent[]), ...events];
      if (queue.length > MAX_QUEUE) {
        this.log.error(`Navbat ${MAX_QUEUE} tadan oshdi — eng eski ${queue.length - MAX_QUEUE} ta voqea tashlandi`);
        queue = queue.slice(queue.length - MAX_QUEUE);
      }
      await files.queue.write(queue);
      this.log.debug(`Qurilmadan ${events.length} ta voqea o'qildi`);
    }
    // Voqealar lokal navbatga yozildi — endi ular yo'qolmaydi, vaqtni suramiz
    await files.state.write({ lastSyncedTo: end.toISOString() });
    if (events.length > 0) await this.flushQueue();
  }

  // --- Buyruqlar -------------------------------------------------------

  private async processCommands(): Promise<void> {
    // Qurilma ulanmayotgan bo'lsa buyruq olmaymiz: aks holda ular SENT bo'lib,
    // behuda urinish sarflanardi
    if (this.now() < this.deviceRetryAt || this.now() < this.erpRetryAt) return;
    let commands: AgentCommand[];
    try {
      commands = await this.erp.commands(COMMANDS_PER_TICK);
      this.erpSucceeded();
    } catch (err) {
      this.erpFailed(err);
      return;
    }
    for (const command of commands) {
      const outcome = await this.execute(command);
      if (outcome === "device-offline") return; // ack yo'q — ERP buyruqni keyin qayta beradi
      try {
        await this.erp.ack(command.id, outcome.success, outcome.error);
      } catch (err) {
        this.erpFailed(err);
        return;
      }
    }
  }

  private async execute(command: AgentCommand): Promise<{ success: boolean; error?: string } | "device-offline"> {
    const label = `${command.type} ${command.employeeNo} (urinish ${command.attempts})`;
    try {
      if (command.type === "ADD_OR_UPDATE_USER") {
        const how = await addOrUpdateUser(this.isapi!, { ...this.cfg.isapi, nameMaxBytes: await this.resolveNameMax() }, {
          employeeNo: command.payload.employeeNo,
          name: command.payload.name ?? command.payload.employeeNo,
        });
        this.log.info(`${label}: ${how === "created" ? "qo'shildi" : "yangilandi"}`);
      } else if (command.type === "SET_FACE") {
        let image: Buffer;
        try {
          image = await this.erp.faceImage(command.id);
        } catch (err) {
          if (err instanceof ErpError && err.status === 404) return { success: false, error: "Xodimda surat yo'q" };
          throw err;
        }
        const result = await setFace(this.isapi!, this.cfg.isapi, command.payload.employeeNo, image);
        this.log.info(`${label}: yuz yuklandi (${Math.round(result.bytes / 1024)} KB${result.replaced ? ", eskisi almashtirildi" : ""})`);
      } else if (command.type === "DELETE_USER") {
        await deleteUser(this.isapi!, command.payload.employeeNo);
        this.log.info(`${label}: o'chirildi`);
      } else {
        return { success: false, error: `Noma'lum buyruq turi: ${String(command.type)}` };
      }
      this.deviceSucceeded();
      return { success: true };
    } catch (err) {
      if (err instanceof IsapiError && err.network) {
        this.deviceFailed(err);
        return "device-offline";
      }
      if (err instanceof ErpError && err.retryable) {
        this.erpFailed(err);
        return "device-offline";
      }
      const error = err instanceof IsapiError ? err.describe() : errorText(err);
      this.log.warn(`${label}: xato — ${error}`);
      return { success: false, error };
    }
  }

  private async resolveNameMax(): Promise<number> {
    if (this.cfg.isapi.nameMaxBytes) return this.cfg.isapi.nameMaxBytes;
    this.nameMaxBytes ??= (await readNameMaxBytes(this.isapi!)) ?? DEFAULT_NAME_MAX_BYTES;
    return this.nameMaxBytes;
  }

  // --- Backoff ---------------------------------------------------------

  private deviceFailed(err: unknown) {
    const wait = this.deviceBackoff.fail();
    this.deviceRetryAt = this.now() + wait;
    this.log.warn(`Qurilma bilan aloqa yo'q: ${errorText(err)} — ${Math.round(wait / 1000)} s dan keyin qayta`);
  }

  private deviceSucceeded() {
    if (this.deviceBackoff.failing) this.log.info("Qurilma bilan aloqa tiklandi");
    this.deviceBackoff.succeed();
    this.deviceRetryAt = 0;
  }

  private erpFailed(err: unknown) {
    const wait = this.erpBackoff.fail();
    this.erpRetryAt = this.now() + wait;
    this.log.warn(`ERP bilan aloqa yo'q: ${errorText(err)} — ${Math.round(wait / 1000)} s dan keyin qayta`);
  }

  private erpSucceeded() {
    if (this.erpBackoff.failing) this.log.info("ERP bilan aloqa tiklandi");
    this.erpBackoff.succeed();
    this.erpRetryAt = 0;
  }
}
