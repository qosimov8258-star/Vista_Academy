import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { applyDownloadedEnvFiles, loadConfig } from "../src/config";

test("ERP'dan yuklab olingan hik-agent*.env fayllari qo'shiladi, tokenlar birlashadi", () => {
  const dir = mkdtempSync(join(tmpdir(), "hik-env-"));
  writeFileSync(join(dir, "hik-agent.env"), "ERP_URL=https://bog.zeeron.uz/api/v1\nAGENT_TOKENS=hik_aaa\n");
  writeFileSync(join(dir, "hik-agent (1).env"), "ERP_URL=https://bog.zeeron.uz/api/v1\nAGENT_TOKENS=hik_bbb\n");
  writeFileSync(join(dir, "boshqa.env"), "AGENT_TOKENS=hik_begona\n");
  const env: NodeJS.ProcessEnv = {};
  const used = applyDownloadedEnvFiles(dir, env);
  assert.deepEqual(used.sort(), ["hik-agent (1).env", "hik-agent.env"]);
  const config = loadConfig(env);
  assert.equal(config.erpUrl, "https://bog.zeeron.uz/api/v1");
  assert.deepEqual(config.tokens.sort(), ["hik_aaa", "hik_bbb"]);
});

test(".env dagi qiymatlar ustun, tokenlar takrorlanmaydi", () => {
  const dir = mkdtempSync(join(tmpdir(), "hik-env-"));
  writeFileSync(join(dir, "hik-agent.env"), "ERP_URL=https://boshqa/api/v1\nAGENT_TOKENS=hik_aaa\nLOG_LEVEL=debug\n");
  const env: NodeJS.ProcessEnv = { ERP_URL: "https://asl/api/v1", AGENT_TOKENS: "hik_aaa,hik_ccc" };
  applyDownloadedEnvFiles(dir, env);
  const config = loadConfig(env);
  assert.equal(config.erpUrl, "https://asl/api/v1");
  assert.deepEqual(config.tokens, ["hik_aaa", "hik_ccc"]);
  assert.equal(config.logLevel, "debug");
});
