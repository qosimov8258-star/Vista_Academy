import { createInterface } from "readline/promises";
import { loadConfig } from "./config";
import { pairAgent, readPairedAgent } from "./pairing";

/**
 * Agentni ERP filialiga ulash (bir marta):  npm run pair -- K7Q2-M9XD
 * Kod berilmasa so'raydi. Kod ERP → Face ID → Qurilmalar → "Agentni ulash".
 */
async function main() {
  const config = loadConfig();
  const existing = readPairedAgent(config.dataDir);
  if (existing) {
    console.log(`Diqqat: agent allaqachon ulangan (${existing.organizationName} — ${existing.branchName}). Yangi kod bilan qayta ulanadi.`);
  }
  let code = process.argv[2];
  if (!code) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    code = await rl.question("ERP'dagi ulash kodini kiriting (masalan K7Q2-M9XD): ");
    rl.close();
  }
  const agent = await pairAgent(config.erpUrl, config.dataDir, code);
  console.log(`Ulandi: ${agent.organizationName} — ${agent.branchName}.`);
  console.log("Endi agentni ishga tushiring: npm start (yoki pm2). ERP'da qo'shilgan qurilmalar o'zi ulanadi.");
}

main().catch((err) => {
  console.error(`Ulanmadi: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
