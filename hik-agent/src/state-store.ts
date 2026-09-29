import { promises as fs } from "fs";
import path from "path";

/**
 * Qurilma bo'yicha lokal holat: oxirgi sinxron vaqti va ERP'ga hali
 * yetib bormagan voqealar navbati. Fayl atomik yoziladi (vaqtinchalik
 * fayl + rename) — agent yozish paytida o'chsa ham fayl buzilmaydi.
 */
export class JsonFile<T> {
  constructor(
    private readonly file: string,
    private readonly fallback: T,
  ) {}

  async read(): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(this.fallback);
      throw err;
    }
  }

  async write(value: T): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value), "utf8");
    await fs.rename(tmp, this.file);
  }

  async append(line: unknown): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.appendFile(this.file, `${JSON.stringify(line)}\n`, "utf8");
  }
}

export interface DeviceState {
  /** Voqealar shu vaqtgacha qurilmadan o'qib olingan (ISO) */
  lastSyncedTo: string | null;
}

export function deviceFiles(dataDir: string, deviceId: string) {
  return {
    state: new JsonFile<DeviceState>(path.join(dataDir, `state-${deviceId}.json`), { lastSyncedTo: null }),
    queue: new JsonFile<unknown[]>(path.join(dataDir, `queue-${deviceId}.json`), []),
    rejected: new JsonFile<unknown>(path.join(dataDir, `rejected-${deviceId}.jsonl`), null),
  };
}
