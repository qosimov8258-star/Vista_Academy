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

/**
 * Windows vazifalar rejalashtiruvchisi uchun XML. `schtasks /SC ONSTART` bilan
 * yaratilgan vazifa standart sozlamalarni oladi: batareyada ishga tushmaydi,
 * tok o'chib batareyaga o'tganda to'xtatiladi va 3 kundan keyin o'ldiriladi —
 * bog'chadagi noutbukda agent "Navbatda" turib qoladi (Holiday Kids, 2026-10-23).
 * Shuning uchun sozlamalar XML orqali aniq beriladi.
 */
export function windowsTaskXml(layout: InstallLayout): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Zeeron agent: ERP va Face ID terminali o'rtasidagi lokal agent</Description>
    <URI>\\${TASK_NAME}</URI>
  </RegistrationInfo>
  <Triggers>
    <!-- Kompyuter yonishi bilan (foydalanuvchi kirmasa ham); 30 s — tarmoq ko'tarilsin -->
    <BootTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </BootTrigger>
    <!-- Zaxira: kimdir kirganda ham — agent ishlab turgan bo'lsa IgnoreNew tufayli hech narsa qilmaydi -->
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
    <!-- Zaxira: har 5 daqiqada — agent biror sabab bilan ishga tushmay qolsa, o'zi ko'tariladi
         (Holiday Kids noutbukida aynan shu sozlama bilan sinalgan) -->
    <TimeTrigger>
      <Enabled>true</Enabled>
      <StartBoundary>2026-01-01T00:00:00</StartBoundary>
      <Repetition>
        <Interval>PT5M</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <!-- S-1-5-18 = SYSTEM -->
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <!-- Batareyada ham ishga tushsin va tok o'chganda to'xtatilmasin -->
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <!-- Ishga tushish vaqti o'tkazib yuborilgan bo'lsa — imkon bo'lishi bilan -->
    <StartWhenAvailable>true</StartWhenAvailable>
    <!-- Tarmoqni agentning o'zi kutadi (qayta urinish bilan) -->
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <!-- PT0S = vaqt chegarasi yo'q (standart 3 kun) -->
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <!-- Yiqilsa — har daqiqada qayta, 999 martagacha -->
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${esc(layout.binary)}</Command>
      <Arguments>--service</Arguments>
      <WorkingDirectory>${esc(layout.baseDir)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`.replace(/\n/g, "\r\n");
}

/** schtasks /XML faylni UTF-16 (BOM bilan) kutadi. */
export function utf16WithBom(text: string): Buffer {
  return Buffer.from(`﻿${text}`, "utf16le");
}

/** Tizim yonganda o'zi ishga tushishi va hozir ishga tushirish. */
function registerAutostart(layout: InstallLayout) {
  if (process.platform === "win32") {
    // SYSTEM nomidan, kompyuter yonishi bilan (foydalanuvchi kirmasa ham), konsol oynasisiz — sozlamalar windowsTaskXml'da
    const xmlFile = path.join(layout.baseDir, `${TASK_NAME}.task.xml`);
    writeFileSync(xmlFile, utf16WithBom(windowsTaskXml(layout)));
    try {
      run("schtasks", ["/Create", "/TN", TASK_NAME, "/XML", xmlFile, "/F"]);
    } finally {
      rmSync(xmlFile, { force: true });
    }
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

