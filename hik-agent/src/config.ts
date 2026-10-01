import "dotenv/config";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parse as parseEnv } from "dotenv";

/** ERP'dagi "Agent sozlamasini yuklab olish" beradigan fayl(lar): hik-agent.env, "hik-agent (1).env" ... */
const DOWNLOADED_ENV_FILE = /^hik-agent.*\.env$/i;

/**
 * Agent papkasidagi ERP'dan yuklab olingan sozlama fayllarini qo'shadi — qayta
 * nomlash yoki tokenni qo'lda nusxalash shart emas. `.env` dagi qiymatlar ustun;
 * AGENT_TOKENS esa birlashtiriladi (bir obyektda bir nechta terminal bo'lsa
 * har birining fayli shu papkaga tashlanadi).
 */
export function applyDownloadedEnvFiles(dir: string, env: NodeJS.ProcessEnv = process.env): string[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => DOWNLOADED_ENV_FILE.test(f)).sort();
  } catch {
    return [];
  }
  const tokens = new Set(
    (env.AGENT_TOKENS ?? env.AGENT_TOKEN ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  );
  for (const file of files) {
    const parsed = parseEnv(readFileSync(join(dir, file)));
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "AGENT_TOKENS" || key === "AGENT_TOKEN") {
        value.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => tokens.add(t));
      } else if (env[key] === undefined || env[key] === "") {
        env[key] = value;
      }
    }
  }
  if (tokens.size > 0) env.AGENT_TOKENS = [...tokens].join(",");
  return files;
}

applyDownloadedEnvFiles(process.cwd());

/** Agent sozlamalari — .env va hik-agent*.env dan. Tokenlar hech qachon logga chiqmaydi. */
export interface AgentConfig {
  erpUrl: string;
  tokens: string[];
  pollIntervalMs: number;
  dataDir: string;
  initialLookbackHours: number;
  logLevel: "debug" | "info" | "warn" | "error";
  isapi: IsapiOptions;
}

export interface IsapiOptions {
  faceJsonField: string;
  faceImageField: string;
  faceLibType: string;
  faceFdid: string;
  faceMaxBytes: number;
  /** null — qurilma capabilities'dan aniqlanadi */
  nameMaxBytes: number | null;
  userValidEnd: string;
}

function num(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} musbat son bo'lishi kerak`);
  return value;
}

function str(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const raw = env[name]?.trim();
  return raw ? raw : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const erpUrl = (env.ERP_URL ?? "").trim().replace(/\/+$/, "");
  if (!erpUrl) throw new Error("ERP_URL berilmagan (.env)");
  const tokens = (env.AGENT_TOKENS ?? env.AGENT_TOKEN ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) throw new Error("AGENT_TOKENS berilmagan (.env) — ERP'dagi qurilma tokenini qo'ying");
  const level = str(env, "LOG_LEVEL", "info");
  const nameMax = env.NAME_MAX_BYTES?.trim();
  return {
    erpUrl,
    tokens,
    pollIntervalMs: num(env, "POLL_INTERVAL_SEC", 5) * 1000,
    dataDir: str(env, "DATA_DIR", "./data"),
    initialLookbackHours: num(env, "INITIAL_LOOKBACK_HOURS", 24),
    logLevel: (["debug", "info", "warn", "error"].includes(level) ? level : "info") as AgentConfig["logLevel"],
    isapi: {
      faceJsonField: str(env, "FACE_JSON_FIELD", "FaceDataRecord"),
      faceImageField: str(env, "FACE_IMAGE_FIELD", "img"),
      faceLibType: str(env, "FACE_LIB_TYPE", "blackFD"),
      faceFdid: str(env, "FACE_FDID", "1"),
      faceMaxBytes: num(env, "FACE_MAX_BYTES", 200_000),
      nameMaxBytes: nameMax ? num(env, "NAME_MAX_BYTES", 32) : null,
      userValidEnd: str(env, "USER_VALID_END", "2037-12-31T23:59:59"),
    },
  };
}
