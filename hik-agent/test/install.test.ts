import { test } from "node:test";
import assert from "node:assert/strict";
import { codeFromFileName } from "../src/install";

test("ulash kodi o'rnatuvchi fayl nomidan olinadi", () => {
  assert.equal(codeFromFileName("C:\\Users\\a\\Downloads\\zeeron-agent-K7Q2-M9XD.exe"), "K7Q2-M9XD");
  assert.equal(codeFromFileName("/Users/a/Downloads/Zeeron-Agent-k7q2-m9xd (1).pkg"), "K7Q2-M9XD");
  assert.equal(codeFromFileName("zeeron-agent-K7Q2M9XD.exe"), "K7Q2-M9XD");
  assert.equal(codeFromFileName("zeeron-agent.exe"), null);
  assert.equal(codeFromFileName("zeeron-agent-win-x64.exe"), null);
});
