import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { hostname } from "os";
import path from "path";
import { request } from "urllib";

/**
 * Obyekt agentini ERP filialiga ulash: ERP'dagi bir martalik kod bilan bir marta
 * ulanadi va doimiy kalit (hka_...) oladi. Kalit DATA_DIR/agent.json da (faqat
 * egasi o'qiy oladi) saqlanadi — .env ga hech narsa yozilmaydi. Shundan keyin
 * ERP'da filialga qo'shilgan har bir qurilma agentga o'zi tushadi.
 */
export interface PairedAgent {
  erpUrl: string;
  agentKey: string;
  organizationName: string;
  branchName: string;
  pairedAt: string;
}

export interface AgentDeviceRef {
  id: string;
  name: string;
  model: string | null;
}

export function agentFilePath(dataDir: string): string {
  return path.join(dataDir, "agent.json");
}

export function readPairedAgent(dataDir: string): PairedAgent | null {
  const file = agentFilePath(dataDir);
  if (!existsSync(file)) return null;
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<PairedAgent>;
  return parsed.agentKey && parsed.erpUrl ? (parsed as PairedAgent) : null;
}

export class PairingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function erpJson<T>(url: string, init: { method: "GET" | "POST"; key?: string; body?: unknown }): Promise<T> {
  let res;
  try {
    res = await request(url, {
      method: init.method,
      headers: { Accept: "application/json", ...(init.key ? { Authorization: `Bearer ${init.key}` } : {}) },
      ...(init.body !== undefined ? { content: JSON.stringify(init.body), contentType: "application/json" } : {}),
      dataType: "json",
      timeout: 20_000,
      // Kalit boshqa manzilga sizib ketmasin
      followRedirect: false,
    });
  } catch (err) {
    throw new PairingError(`ERP'ga ulanib bo'lmadi: ${err instanceof Error ? err.message : String(err)}`, 0);
  }
  const payload = res.data as { success?: boolean; data?: T; error?: { message?: string } } | null;
  if (res.status >= 400 || !payload?.success) {
    throw new PairingError(payload?.error?.message ?? `ERP javobi ${res.status}`, res.status);
  }
  return payload.data as T;
}

/** Kod bilan ulanadi va kalitni saqlaydi. */
export async function pairAgent(erpUrl: string, dataDir: string, code: string): Promise<PairedAgent> {
  const data = await erpJson<{ agentKey: string; organizationName: string; branchName: string }>(`${erpUrl}/agent/pair`, {
    method: "POST",
    body: { code: code.trim(), name: hostname().slice(0, 100) },
  });
  const agent: PairedAgent = {
    erpUrl,
    agentKey: data.agentKey,
    organizationName: data.organizationName,
    branchName: data.branchName,
    pairedAt: new Date().toISOString(),
  };
  mkdirSync(dataDir, { recursive: true });
  const file = agentFilePath(dataDir);
  writeFileSync(file, JSON.stringify(agent, null, 2), { mode: 0o600 });
  chmodSync(file, 0o600);
  return agent;
}

/** Filialdagi faol qurilmalar — ulangan agent shularga xizmat qiladi. */
export function listAgentDevices(agent: PairedAgent): Promise<AgentDeviceRef[]> {
  return erpJson<AgentDeviceRef[]>(`${agent.erpUrl}/agent/devices`, { method: "GET", key: agent.agentKey });
}
