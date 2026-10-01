import "dotenv/config";

/** ERP_URL berilmasa — Zeeron production (agent yo'llari /api/v1/agent har qanday hostda ishlaydi). */
export const DEFAULT_ERP_URL = "https://platform.zeeron.uz/api/v1";

/** Agent sozlamalari — .env'dan (ixtiyoriy). Tokenlar hech qachon logga chiqmaydi. */
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
  // Sukut — Zeeron ERP: ulangan agentga .env umuman kerak emas (`npm run pair`)
  const erpUrl = (env.ERP_URL ?? "").trim().replace(/\/+$/, "") || DEFAULT_ERP_URL;
  // Bo'sh bo'lishi mumkin — agent `npm run pair` bilan ulangan bo'lsa qurilmalar ERP'dan olinadi
  const tokens = (env.AGENT_TOKENS ?? env.AGENT_TOKEN ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
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
