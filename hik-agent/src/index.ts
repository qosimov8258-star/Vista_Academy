import { loadConfig } from "./config";
import { DeviceWorker } from "./device-worker";
import { createLogger, errorText, setLogLevel } from "./logger";

/**
 * hik-agent: obyekt LAN'idagi Hikvision terminal(lar) ⇄ ERP.
 * Har bir agent tokeni — bitta qurilma, bitta ishchi.
 */
async function main() {
  const config = loadConfig();
  setLogLevel(config.logLevel);
  const log = createLogger("agent");
  log.info(`Ishga tushdi: ${config.tokens.length} ta qurilma, ERP ${config.erpUrl}, har ${config.pollIntervalMs / 1000} s`);

  const workers = config.tokens.map((token) => new DeviceWorker(token, config));
  const shutdown = (signal: string) => {
    log.info(`${signal} — to'xtatilmoqda`);
    workers.forEach((w) => w.stop());
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await Promise.all(workers.map((w) => w.run()));
}

main().catch((err) => {
  createLogger("agent").error(errorText(err));
  process.exit(1);
});
