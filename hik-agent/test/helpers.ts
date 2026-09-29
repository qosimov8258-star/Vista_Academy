import { mkdtempSync } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { loadConfig, type AgentConfig } from "../src/config";

export function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "hik-agent-test-"));
}

export function testConfig(erpUrl: string, token: string, dataDir: string, extra: Record<string, string> = {}): AgentConfig {
  return loadConfig({ ERP_URL: erpUrl, AGENT_TOKENS: token, DATA_DIR: dataDir, POLL_INTERVAL_SEC: "1", ...extra });
}

/** Katta (≈1 MB) shovqinli JPEG — kichraytirish sinovi uchun */
export async function bigJpeg(size = 1400): Promise<Buffer> {
  const raw = Buffer.alloc(size * size * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
}

/** Qurilma vaqti (+05:00) */
export const tashkent = (hhmmss: string, date = "2026-09-29") => `${date}T${hhmmss}+05:00`;
