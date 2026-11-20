import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { loadDisabledFeatures } from "../../../common/features/feature-access";
import { decryptSecret, encryptSecret } from "../../../common/crypto/reversible-secret";
import { TenantAuthenticatedUser, TenantScope, requireOperationalScope, toTenantScope } from "../../iam/tenant-auth.types";
import { AuditLogService } from "../../audit-log/audit-log.service";
import type { AgentDevice } from "../agent/agent-token.guard";
import type { AgentEventDto } from "../dto/agent-events.dto";
import { FaceIdAgentService } from "../face-id-agent.service";
import { AgentCommand, FaceIdCommandsService } from "../face-id-commands.service";
import { fitFaceJpeg } from "../face-image";
import { HikGwClient, HikGwDevice, HikGwError, faceSyncErrorText, hikGwConfig } from "./hik-gateway.client";
import { isStrongIsupKey, isapiTime, newIsupDeviceId, newIsupKey, truncateUtf8 } from "./gateway-rules";

export type GatewayApi = Pick<
  HikGwClient,
  "devices" | "addDevice" | "setDeviceKey" | "deleteDevice" | "upsertPerson" | "setFace" | "removePerson" | "searchEvents"
>;

/** Navbat va hodisalar shu oraliqda tekshiriladi (agent 5 soniyada tekshirardi). */
const TICK_INTERVAL_MS = 20_000;
const FIRST_RUN_DELAY_MS = 30_000;
/** Bitta aylanishda bir qurilmaga ko'pi bilan shuncha buyruq. */
const COMMANDS_PER_TICK = 20;
/** Terminal qabul qiladigan yuz rasmi hajmi (hik-agent bilan bir xil). */
const FACE_MAX_BYTES = 200_000;
const NAME_MAX_BYTES = 32;
/** Hodisalar: birinchi ulanishda shuncha orqaga qaraladi, keyin ozgina ustma-ust o'qiladi. */
const INITIAL_LOOKBACK_MS = 24 * 3_600_000;
const OVERLAP_MS = 2 * 60_000;
const EVENTS_PAGE = 30;
const EVENTS_MAX_PAGES = 20;

const workerSelect = {
  id: true,
  organizationId: true,
  branchId: true,
  name: true,
  gatewayIndex: true,
  gatewayEventsSince: true,
  branch: { select: { timezone: true } },
} satisfies Prisma.FaceIdDeviceSelect;
type WorkerDevice = Prisma.FaceIdDeviceGetPayload<{ select: typeof workerSelect }>;

/**
 * Face ID — internet (ISUP gateway) orqali ulanish, agentsiz.
 *
 * Terminal Hik Device Gateway serveriga ISUP 5.0 bilan O'ZI ulanadi
 * (bog'chada router sozlanmaydi, kompyuter kerak emas). Bu servis agent
 * qilgan ishni serverning o'zida bajaradi:
 *   · buyruqlar navbati (`FaceIdCommandsService.dispatch/ack`) gateway orqali
 *     terminalda bajariladi — odam qo'shish, yuz, o'chirish;
 *   · terminal xotirasidagi o'tishlar (`AcsEvent`) o'qilib, agent hodisalari
 *     bilan bir xil yo'ldan (`FaceIdAgentService.ingestEvents`) qabul qilinadi.
 *
 * Agent bilan parallel ishlay oladi: buyruq kim birinchi olsa o'shaniki
 * (SENT belgisi), hodisa takrori esa bazada rad etiladi. Gateway sozlanmagan
 * serverda (env yo'q) servis hech narsa qilmaydi.
 */
@Injectable()
export class FaceIdGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FaceIdGatewayService.name);
  private client: GatewayApi | null | undefined;
  private intervalHandle?: ReturnType<typeof setInterval>;
  private timeoutHandle?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: FaceIdCommandsService,
    private readonly agent: FaceIdAgentService,
    private readonly auditLog: AuditLogService,
  ) {}

  onModuleInit() {
    if (!this.api()) return;
    this.timeoutHandle = setTimeout(() => void this.tick(), FIRST_RUN_DELAY_MS);
    this.intervalHandle = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
  }

  /** Testlarda soxta klient qo'yiladi. */
  useClient(client: GatewayApi | null) {
    this.client = client;
  }

  private api(): GatewayApi | null {
    if (this.client === undefined) {
      const cfg = hikGwConfig();
      this.client = cfg ? new HikGwClient(cfg) : null;
    }
    return this.client;
  }

  // ---------------------------------------------------------------------
  // Admin tomoni
  // ---------------------------------------------------------------------

  /** Admin panel uchun: gateway rejimi bormi va terminalga qaysi server manzili kiritiladi. */
  info() {
    const host = process.env.FACE_ID_ISUP_HOST?.trim() || null;
    return {
      enabled: !!this.api() && !!host,
      host,
      // Gateway ro'yxatga olish porti — 7661 (terminalda sukut bo'yicha 7660 turadi, u ishlamaydi)
      port: Number(process.env.FACE_ID_ISUP_PORT) || 7661,
    };
  }

  /**
   * Qurilmani gateway'ga bog'laydi: ISUP ID va kalit beriladi (bo'lsa — o'sha
   * qoladi), gateway'da yozuv ochiladi yoki mavjudi olinib kaliti ERP'dagiga
   * tenglashtiriladi. Keyin filialdagi hamma odam navbatga qo'yiladi.
   */
  async connect(caller: TenantAuthenticatedUser, id: string) {
    const api = this.requireApi();
    const scope = toTenantScope(caller);
    const device = await this.requireWritableDevice(scope, id);
    const key = device.isupKeyEncrypted ? decryptSecret(device.isupKeyEncrypted, "DEVICE_SECRET_KEY") : "";
    const isupKey = isStrongIsupKey(key) ? key : newIsupKey();

    let isupDeviceId = device.isupDeviceId;
    let existing: HikGwDevice | undefined;
    try {
      const onGateway = await api.devices();
      if (isupDeviceId) {
        existing = onGateway.find((d) => d.ehomeId.toUpperCase() === isupDeviceId!.toUpperCase());
      } else {
        const taken = new Set(onGateway.map((d) => d.ehomeId.toUpperCase()));
        do isupDeviceId = newIsupDeviceId();
        while (taken.has(isupDeviceId));
      }
      const gatewayIndex = existing
        ? (await api.setDeviceKey(existing.devIndex, isupDeviceId, isupKey, device.name), existing.devIndex)
        : await api.addDevice(isupDeviceId, isupKey, device.name);
      await this.prisma.faceIdDevice.update({
        where: { id: device.id },
        data: { gatewayIndex, isupDeviceId, isupKeyEncrypted: encryptSecret(isupKey, "DEVICE_SECRET_KEY") },
        select: { id: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("ISUP ID band chiqdi — qayta urinib ko'ring");
      }
      throw new ServiceUnavailableException(`Gateway'ga ulab bo'lmadi: ${err instanceof Error ? err.message : String(err)}`);
    }

    const queued = await this.commands.enqueueFullSync(device);
    await this.auditLog.logFromUser(caller, {
      action: "faceId.device.gateway",
      entityType: "FaceIdDevice",
      entityId: device.id,
      branchId: device.branchId,
      summary: `"${device.name}" qurilmasi internet (ISUP gateway) orqali ulashga tayyorlandi`,
    });
    return { ...this.isupParams(isupDeviceId, isupKey), online: existing?.online ?? false, queued };
  }

  /** Terminalga kiritiladigan qiymatlar va hozirgi aloqa holati (kalit faqat shu yerda ko'rinadi). */
  async details(scope: TenantScope, id: string) {
    const device = await this.requireWritableDevice(scope, id);
    if (!device.gatewayIndex || !device.isupDeviceId || !device.isupKeyEncrypted) {
      throw new NotFoundException("Qurilma internet orqali ulanmagan");
    }
    let online: boolean | null = null;
    let offlineHint: number | null = null;
    try {
      const gw = (await this.requireApi().devices()).find((d) => d.devIndex === device.gatewayIndex);
      online = gw?.online ?? false;
      offlineHint = gw?.offlineHint ?? null;
    } catch {
      // Gateway vaqtincha javob bermasa ham qiymatlar ko'rinib tursin
    }
    return { ...this.isupParams(device.isupDeviceId, decryptSecret(device.isupKeyEncrypted, "DEVICE_SECRET_KEY")), online, offlineHint };
  }

  /** Gateway'dan uzish: yozuv gateway'dan o'chadi, qurilma agent bilan (bo'lsa) ishlayveradi. */
  async disconnect(caller: TenantAuthenticatedUser, id: string) {
    const device = await this.requireWritableDevice(toTenantScope(caller), id);
    if (device.gatewayIndex) {
      try {
        await this.api()?.deleteDevice(device.gatewayIndex);
      } catch (err) {
        this.logger.warn(`Gateway'dan o'chirib bo'lmadi (${device.gatewayIndex}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await this.prisma.faceIdDevice.update({
      where: { id: device.id },
      data: { gatewayIndex: null, gatewayEventsSince: null },
      select: { id: true },
    });
    await this.auditLog.logFromUser(caller, {
      action: "faceId.device.gateway.off",
      entityType: "FaceIdDevice",
      entityId: device.id,
      branchId: device.branchId,
      summary: `"${device.name}" qurilmasi internet (ISUP gateway) ulanishidan uzildi`,
    });
    return { id: device.id };
  }

  /** Qurilma o'chirilishidan oldin chaqiriladi (imkon qadar). */
  async forget(gatewayIndex: string | null) {
    if (!gatewayIndex) return;
    try {
      await this.api()?.deleteDevice(gatewayIndex);
    } catch (err) {
      this.logger.warn(`Gateway'dan o'chirib bo'lmadi (${gatewayIndex}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private isupParams(deviceId: string, key: string) {
    const { host, port } = this.info();
    return { host, port, deviceId, key };
  }

  private requireApi(): GatewayApi {
    const api = this.api();
    if (!api) throw new ServiceUnavailableException("ISUP gateway sozlanmagan");
    return api;
  }

  private async requireWritableDevice(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    const device = await this.prisma.faceIdDevice.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true, organizationId: true, branchId: true, name: true, gatewayIndex: true, isupDeviceId: true, isupKeyEncrypted: true },
    });
    if (!device) throw new NotFoundException("Qurilma topilmadi");
    return device;
  }

  // ---------------------------------------------------------------------
  // Ishchi: buyruqlar va hodisalar
  // ---------------------------------------------------------------------

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.warn(`Gateway aylanishi to'xtadi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  /** Bitta to'liq aylanish — test ham shuni chaqiradi. */
  async runOnce(now = new Date()): Promise<{ commands: number; failed: number; events: number }> {
    const total = { commands: 0, failed: 0, events: 0 };
    const api = this.api();
    if (!api) return total;
    const devices = await this.prisma.faceIdDevice.findMany({ where: { gatewayIndex: { not: null }, status: "ACTIVE" }, select: workerSelect });
    if (devices.length === 0) return total;

    // Gateway'dagi holat — hamma qurilma uchun bitta so'rov
    const status = new Map((await api.devices()).map((d) => [d.devIndex, d]));
    const disabledByOrg = new Map<string, string[]>();
    for (const device of devices) {
      if (!status.get(device.gatewayIndex!)?.online) continue; // terminal o'chiq — navbat kutadi
      try {
        let disabled = disabledByOrg.get(device.organizationId);
        if (!disabled) disabledByOrg.set(device.organizationId, (disabled = await loadDisabledFeatures(this.prisma, device.organizationId)));
        if (disabled.includes("faceId")) continue;
        const agentDevice: AgentDevice = {
          id: device.id,
          organizationId: device.organizationId,
          branchId: device.branchId,
          name: device.name,
          disabledFeatures: disabled,
        };
        await this.agent.touch(device.id);
        const c = await this.runCommands(api, device, agentDevice, now);
        total.commands += c.done;
        total.failed += c.failed;
        total.events += await this.pullEvents(api, device, agentDevice, now);
      } catch (err) {
        this.logger.warn(`Qurilma "${device.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return total;
  }

  private async runCommands(api: GatewayApi, device: WorkerDevice, agentDevice: AgentDevice, now: Date) {
    const batch = await this.commands.dispatch(agentDevice, COMMANDS_PER_TICK, now);
    let done = 0;
    let failed = 0;
    for (let i = 0; i < batch.length; i++) {
      const command = batch[i];
      try {
        await this.execute(api, device.gatewayIndex!, agentDevice, command);
        await this.commands.ack(agentDevice, command.id, { success: true }, now);
        done++;
      } catch (err) {
        // Aloqa uzildi yoki terminal o'chdi — urinish sanalmaydi, qolganlari ham navbatga qaytadi
        if (err instanceof HikGwError && err.transient) {
          await this.commands.release(
            agentDevice,
            batch.slice(i).map((c) => c.id),
          );
          this.logger.warn(`Qurilma "${device.name}": navbat to'xtadi — ${err.message}`);
          break;
        }
        await this.commands.ack(agentDevice, command.id, { success: false, error: faceSyncErrorText(err) }, now);
        failed++;
      }
    }
    return { done, failed };
  }

  private async execute(api: GatewayApi, devIndex: string, agentDevice: AgentDevice, command: AgentCommand) {
    if (command.type === "DELETE_USER") {
      await api.removePerson(devIndex, command.employeeNo);
      return;
    }
    if (command.type === "ADD_OR_UPDATE_USER") {
      const name = String((command.payload as { name?: unknown } | null)?.name ?? command.employeeNo);
      await api.upsertPerson(devIndex, command.employeeNo, truncateUtf8(name, NAME_MAX_BYTES));
      return;
    }
    // SET_FACE: surat serverda terminal qabul qiladigan hajmga keltiriladi
    const image = await this.commands.faceImage(agentDevice, command.id);
    let jpeg: Buffer;
    try {
      jpeg = await fitFaceJpeg(Buffer.from(image.data), FACE_MAX_BYTES);
    } catch {
      throw new HikGwError("picFormatError", "Rasmni terminal formatiga keltirib bo'lmadi");
    }
    await api.setFace(devIndex, command.employeeNo, jpeg);
  }

  /** Terminal xotirasidagi yangi o'tishlarni o'qib, agent hodisalari yo'lidan qabul qiladi. */
  private async pullEvents(api: GatewayApi, device: WorkerDevice, agentDevice: AgentDevice, now: Date): Promise<number> {
    const timezone = device.branch.timezone;
    const start = device.gatewayEventsSince ? new Date(device.gatewayEventsSince.getTime() - OVERLAP_MS) : new Date(now.getTime() - INITIAL_LOOKBACK_MS);
    const events: AgentEventDto[] = [];
    let position = 0;
    for (let page = 0; page < EVENTS_MAX_PAGES; page++) {
      const res = await api.searchEvents(device.gatewayIndex!, {
        startTime: isapiTime(start, timezone),
        endTime: isapiTime(now, timezone),
        position,
        maxResults: EVENTS_PAGE,
      });
      for (const info of res.events) {
        const dto = toAgentEvent(info);
        if (dto) events.push(dto);
      }
      position += res.events.length;
      if (!res.more || res.events.length === 0) break;
    }
    let inserted = 0;
    for (let i = 0; i < events.length; i += 200) {
      inserted += (await this.agent.ingestEvents(agentDevice, events.slice(i, i + 200))).inserted;
    }
    await this.prisma.faceIdDevice.update({ where: { id: device.id }, data: { gatewayEventsSince: now }, select: { id: true } });
    return inserted;
  }
}

/** ISAPI `InfoList` elementi → agent hodisasi; odam aniqlanmagan yozuvlar tashlab ketiladi (agent bilan bir xil). */
export function toAgentEvent(info: Record<string, unknown>): AgentEventDto | null {
  const employeeNo = info.employeeNoString;
  if (typeof employeeNo !== "string" || !employeeNo || typeof info.serialNo !== "number" || typeof info.time !== "string") return null;
  return {
    serialNo: info.serialNo,
    employeeNo,
    eventTime: info.time,
    major: typeof info.major === "number" ? info.major : 5,
    minor: typeof info.minor === "number" ? info.minor : 0,
    verifyMode: typeof info.currentVerifyMode === "string" ? info.currentVerifyMode : undefined,
    pictureUrl: typeof info.pictureURL === "string" ? info.pictureURL : undefined,
    raw: info,
  };
}
