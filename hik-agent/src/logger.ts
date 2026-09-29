/**
 * Oddiy log: vaqt, daraja, qurilma. Parol va tokenlar logga tushmasligi
 * uchun matndan `hik_...` tokenlar, Authorization sarlavhalari va
 * `password`/`digestAuth` qiymatlari qirqib tashlanadi — ehtiyot chorasi
 * sifatida (kod ularni ataylab logga bermaydi ham).
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let minLevel: Level = "info";
export function setLogLevel(level: Level) {
  minLevel = level;
}

export function redact(text: string): string {
  return text
    .replace(/hik_[A-Za-z0-9_-]{8,}/g, "hik_***")
    .replace(/(authorization["']?\s*[:=]\s*["']?)(bearer|digest|basic)?\s*[^\s"',}]+/gi, "$1***")
    .replace(/("?(password|passwd|digestAuth)"?\s*[:=]\s*")[^"]*"/gi, '$1***"');
}

function write(level: Level, scope: string, message: string) {
  if (ORDER[level] < ORDER[minLevel]) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${redact(message)}`;
  (level === "error" || level === "warn" ? console.error : console.log)(line);
}

export function createLogger(scope: string) {
  return {
    debug: (m: string) => write("debug", scope, m),
    info: (m: string) => write("info", scope, m),
    warn: (m: string) => write("warn", scope, m),
    error: (m: string) => write("error", scope, m),
  };
}

export type Logger = ReturnType<typeof createLogger>;

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
