import { loadConfig } from "./config";
import { ErpClient } from "./erp-client";
import { listAgentDevices, readPairedAgent } from "./pairing";
import { IsapiClient } from "./isapi-client";
import { redact } from "./logger";

/**
 * `npm run probe` — qurilma nimani qo'llashini ko'rsatadi: model,
 * proshivka va ISAPI capabilities. Yuz yuklash qism nomlari, ism uzunligi
 * kabi proshivkaga bog'liq narsalarni shu natija bilan tasdiqlang.
 * Parol va token chiqmaydi.
 */
const ENDPOINTS = [
  "/ISAPI/System/deviceInfo",
  "/ISAPI/AccessControl/UserInfo/capabilities?format=json",
  "/ISAPI/AccessControl/AcsEvent/capabilities?format=json",
  "/ISAPI/Intelligent/FDLib/capabilities?format=json",
  "/ISAPI/Intelligent/FDLib?format=json",
];

async function main() {
  const config = loadConfig();
  // Ulangan agent: qurilmalar ERP'dan; aks holda .env dagi tokenlar
  const paired = readPairedAgent(config.dataDir);
  const clients = paired
    ? (await listAgentDevices(paired)).map((d) => new ErpClient(paired.erpUrl, paired.agentKey, undefined, d.id))
    : config.tokens.map((token) => new ErpClient(config.erpUrl, token));
  if (clients.length === 0) {
    console.log("Qurilma yo'q: agentni ulang (npm run pair) yoki .env ga AGENT_TOKENS yozing");
  }
  for (const erp of clients) {
    const { device } = await erp.config();
    console.log(`\n===== ${device.name} (${device.ip}:${device.port}) =====`);
    if (!device.ip || !device.username || !device.password) {
      console.log("IP, login yoki parol ERP'da kiritilmagan");
      continue;
    }
    const client = new IsapiClient({ ip: device.ip, port: device.port, username: device.username, password: device.password });
    for (const path of ENDPOINTS) {
      try {
        const text = await client.text(path);
        let pretty = text;
        try {
          pretty = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          // XML — o'zicha chiqariladi
        }
        console.log(`\n--- ${path}\n${redact(pretty)}`);
      } catch (err) {
        console.log(`\n--- ${path}\nXATO: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
