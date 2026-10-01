import { spawnSync } from "child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";
import { pairAgent, type PairedAgent } from "./pairing";

/**
 * Bitta faylli zeeron-agent o'zini o'zi o'rnatadi: ERP'dan yuklab olingan fayl
 * nomida ulash kodi bor (zeeron-agent-K7Q2-M9XD.exe / Zeeron-Agent-K7Q2-M9XD.pkg).
 * Ikki marta bosilganda — doimiy joyga ko'chadi, ERP'ga ulanadi va tizim
 * yonganda ko'rinmas holda o'zi ishga tushadigan bo'ladi. Hech narsa yozilmaydi.
 */

export const TASK_NAME = "ZeeronAgent";
export const LAUNCHD_LABEL = "uz.zeeron.agent";

export interface InstallLayout {
  baseDir: string;
  binary: string;
  dataDir: string;
  logFile: string;
}

export function installLayout(platform: NodeJS.Platform = process.platform): InstallLayout {
  // ZEERON_AGENT_HOME — boshqa papkaga o'rnatish (sinov yoki maxsus holat)
  const baseDir = process.env.ZEERON_AGENT_HOME
    ? path.resolve(process.env.ZEERON_AGENT_HOME)
    : platform === "win32"
      ? path.join(process.env.ProgramData ?? "C:\\ProgramData", "Zeeron", "Agent")
      : platform === "darwin"
        ? "/Library/Application Support/Zeeron Agent"
        : path.join(homedir(), ".zeeron-agent");
  return {
    baseDir,
    binary: path.join(baseDir, platform === "win32" ? "zeeron-agent.exe" : "zeeron-agent"),
    dataDir: path.join(baseDir, "data"),
    logFile: path.join(baseDir, "agent.log"),
  };
}

/** Node "single executable" sifatida (zeeron-agent) ishlayaptimi — `node dist/...` emas. */
export function isSingleExecutable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("node:sea") as { isSea(): boolean }).isSea();
  } catch {
    return false;
  }
}

/** "zeeron-agent-K7Q2-M9XD (1).exe" → "K7Q2-M9XD" */
export function codeFromFileName(name: string): string | null {
  const m = /agent[-_ ]([A-Z0-9]{4})-?([A-Z0-9]{4})(?![A-Z0-9])/i.exec(path.basename(name));
  return m ? `${m[1]}-${m[2]}`.toUpperCase() : null;
}

function run(cmd: string, args: string[], ignoreError = false) {
  const res = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", windowsHide: true });
  if (!ignoreError && res.status !== 0) {
    throw new Error(`${cmd} ${args[0] ?? ""}: ${(res.stderr || res.stdout || "").trim() || `chiqish kodi ${res.status}`}`);
  }
  return res;
}

/** Windows: administrator huquqi bormi (`net session` faqat adminda o'tadi). */
export function isWindowsAdmin(): boolean {
  return spawnSync("net", ["session"], { stdio: "ignore", windowsHide: true }).status === 0;
}

/** Windows: o'zini administrator sifatida qayta ishga tushiradi (UAC oynasi) va tugashini kutadi. */
export function relaunchElevated(args: string[]): number {
  const quoted = args.map((a) => `'${a.replace(/'/g, "''")}'`).join(",");
  const ps = `$p = Start-Process -FilePath '${process.execPath.replace(/'/g, "''")}' -ArgumentList ${quoted} -Verb RunAs -Wait -PassThru; exit $p.ExitCode`;
  const res = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { stdio: "inherit" });
  return res.status ?? 1;
}

function stopRunning(layout: InstallLayout) {
  if (process.platform === "win32") {
    run("schtasks", ["/End", "/TN", TASK_NAME], true);
  } else if (process.platform === "darwin") {
    run("launchctl", ["bootout", `system/${LAUNCHD_LABEL}`], true);
  }
  void layout;
}

function launchdPlist(layout: InstallLayout): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${esc(layout.binary)}</string><string>--service</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>${esc(layout.baseDir)}</string>
  <key>StandardOutPath</key><string>${esc(layout.logFile)}</string>
  <key>StandardErrorPath</key><string>${esc(layout.logFile)}</string>
</dict>
</plist>
`;
}

/** Tizim yonganda o'zi ishga tushishi va hozir ishga tushirish. */
function registerAutostart(layout: InstallLayout) {
  if (process.platform === "win32") {
    // SYSTEM nomidan, kompyuter yonishi bilan (foydalanuvchi kirmasa ham), konsol oynasisiz
    run("schtasks", ["/Create", "/TN", TASK_NAME, "/TR", `"${layout.binary}" --service`, "/SC", "ONSTART", "/RU", "SYSTEM", "/RL", "HIGHEST", "/F"]);
    run("schtasks", ["/Run", "/TN", TASK_NAME]);
  } else if (process.platform === "darwin") {
    const plist = `/Library/LaunchDaemons/${LAUNCHD_LABEL}.plist`;
    writeFileSync(plist, launchdPlist(layout), { mode: 0o644 });
    run("launchctl", ["bootstrap", "system", plist]);
  } else {
    throw new Error("Avtomatik ishga tushirish faqat Windows va macOS uchun — Linux'da pm2 dan foydalaning (README)");
  }
}

/**
 * O'rnatish: doimiy joyga nusxa, ERP'ga ulanish, avtomatik ishga tushirish.
 * Administrator/root huquqi bilan chaqiriladi (Windows: UAC, macOS: .pkg).
 */
export async function installAgent(opts: { code: string; erpUrl: string; autostart?: boolean }): Promise<PairedAgent> {
  const layout = installLayout();
  mkdirSync(layout.dataDir, { recursive: true });
  stopRunning(layout);
  if (path.resolve(process.execPath) !== path.resolve(layout.binary)) {
    copyFileSync(process.execPath, layout.binary);
  }
  if (process.platform !== "win32") {
    chmodSync(layout.binary, 0o755);
  }
  if (process.platform === "darwin") {
    // Internetdan yuklangan belgi — launchd ishga tushirganda to'siq bo'lmasin
    run("xattr", ["-d", "com.apple.quarantine", layout.binary], true);
  }
  const agent = await pairAgent(opts.erpUrl, layout.dataDir, opts.code);
  if (opts.autostart !== false) registerAutostart(layout);
  return agent;
}

/** O'chirish: avtomatik ishga tushirish va fayllar (ERP'da agentni "Uzish" ham kerak). */
export function uninstallAgent() {
  const layout = installLayout();
  stopRunning(layout);
  if (process.platform === "win32") {
    run("schtasks", ["/Delete", "/TN", TASK_NAME, "/F"], true);
  } else if (process.platform === "darwin") {
    rmSync(`/Library/LaunchDaemons/${LAUNCHD_LABEL}.plist`, { force: true });
  }
  if (existsSync(layout.baseDir) && path.resolve(process.execPath) !== path.resolve(layout.binary)) {
    rmSync(layout.baseDir, { recursive: true, force: true });
  }
}

/** Buyruq qatoridan `--key qiymat` */
export function argValue(argv: string[], key: string): string | undefined {
  const i = argv.indexOf(key);
  return i >= 0 ? argv[i + 1] : undefined;
}

