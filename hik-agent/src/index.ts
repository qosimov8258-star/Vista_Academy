import { loadConfig, type AgentConfig } from "./config";
import { DeviceWorker } from "./device-worker";
import { createLogger, errorText, setLogLevel, type Logger } from "./logger";
import { listAgentDevices, PairingError, readPairedAgent, type PairedAgent } from "./pairing";

/** Ulangan agent filialdagi qurilmalar ro'yxatini shu oraliqda yangilaydi. */
const DEVICE_LIST_REFRESH_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * hik-agent: obyekt LAN'idagi Hikvision terminal(lar) ⇄ ERP.
 * - Ulangan agent (`npm run pair`): ERP filialidagi barcha faol qurilmalarga
 *   o'zi xizmat qiladi — yangi qurilma qo'shilsa avtomatik ishchi ochiladi.
 * - Eski usul: .env dagi AGENT_TOKENS — har bir token bitta qurilma.
 */
async function main() {
  const config = loadConfig();
  setLogLevel(config.logLevel);
  const log = createLogger("agent");
  const workers = new Map<string, DeviceWorker>();
  let stopping = false;

  const shutdown = (signal: string) => {
    log.info(`${signal} — to'xtatilmoqda`);
    stopping = true;
    workers.forEach((w) => w.stop());
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const paired = readPairedAgent(config.dataDir);
  if (paired) {
    if (config.tokens.length > 0) {
      // Bir qurilmaga ikki ishchi (token + kalit) bo'lsa holat fayllari to'qnashadi
      log.warn(".env dagi AGENT_TOKENS e'tiborsiz qoldirildi — agent ERP'ga ulangan, qurilmalar ERP'dan olinadi");
    }
    log.info(`Ishga tushdi: ulangan agent (${paired.organizationName} — ${paired.branchName}), ERP ${paired.erpUrl}`);
    await runPaired(paired, { ...config, erpUrl: paired.erpUrl }, workers, log, () => stopping);
    return;
  }

  if (config.tokens.length === 0) {
    log.error("Agent ulanmagan: ERP → Face ID → Qurilmalar → \"Agentni ulash\" kodini oling va  npm run pair  ni ishga tushiring");
    process.exit(1);
  }

  log.info(`Ishga tushdi: ${config.tokens.length} ta qurilma, ERP ${config.erpUrl}, har ${config.pollIntervalMs / 1000} s`);
  const tokenWorkers = config.tokens.map((token) => new DeviceWorker(token, config));
  tokenWorkers.forEach((w, i) => workers.set(String(i), w));
  await Promise.all(tokenWorkers.map((w) => w.run()));
}

/** Qurilmalar ro'yxatini ERP'dan olib, ishchilarni ochadi/yopadi. */
async function runPaired(
  agent: PairedAgent,
  config: AgentConfig,
  workers: Map<string, DeviceWorker>,
  log: Logger,
  isStopping: () => boolean,
) {
  let warnedEmpty = false;
  while (!isStopping()) {
    try {
      const devices = await listAgentDevices(agent);
      const ids = new Set(devices.map((d) => d.id));
      for (const device of devices) {
        if (workers.has(device.id)) continue;
        const worker = new DeviceWorker(agent.agentKey, config, Date.now, device.id);
        workers.set(device.id, worker);
        void worker.run();
        log.info(`Qurilma ulandi: ${device.name}${device.model ? ` (${device.model})` : ""}`);
      }
      for (const [id, worker] of workers) {
        if (ids.has(id)) continue;
        worker.stop();
        workers.delete(id);
        log.info("Qurilma ERP'da o'chirildi yoki filialdan olindi — ishchi to'xtatildi");
      }
      if (devices.length === 0 && !warnedEmpty) {
        log.warn("Filialda faol qurilma yo'q — ERP'da Face ID qurilmasini qo'shing, agent uni o'zi topadi");
      }
      warnedEmpty = devices.length === 0;
    } catch (err) {
      if (err instanceof PairingError && err.status === 401) {
        log.error("Agent kaliti bekor qilingan (ERP'da uzilgan) — yangi kod olib qayta ulang:  npm run pair");
      } else {
        log.warn(`Qurilmalar ro'yxatini olib bo'lmadi: ${errorText(err)} — keyinroq qayta urinadi`);
      }
    }
    await sleep(DEVICE_LIST_REFRESH_MS);
  }
}

main().catch((err) => {
  createLogger("agent").error(errorText(err));
  process.exit(1);
});
