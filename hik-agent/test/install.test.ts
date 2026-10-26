import { test } from "node:test";
import assert from "node:assert/strict";
import { codeFromFileName, utf16WithBom, windowsTaskXml, type InstallLayout } from "../src/install";

test("ulash kodi o'rnatuvchi fayl nomidan olinadi", () => {
  assert.equal(codeFromFileName("C:\\Users\\a\\Downloads\\zeeron-agent-K7Q2-M9XD.exe"), "K7Q2-M9XD");
  assert.equal(codeFromFileName("/Users/a/Downloads/Zeeron-Agent-k7q2-m9xd (1).pkg"), "K7Q2-M9XD");
  assert.equal(codeFromFileName("zeeron-agent-K7Q2M9XD.exe"), "K7Q2-M9XD");
  assert.equal(codeFromFileName("zeeron-agent.exe"), null);
  assert.equal(codeFromFileName("zeeron-agent-win-x64.exe"), null);
});

const winLayout: InstallLayout = {
  baseDir: "C:\\ProgramData\\Zeeron\\Agent",
  binary: "C:\\ProgramData\\Zeeron\\Agent\\zeeron-agent.exe",
  dataDir: "C:\\ProgramData\\Zeeron\\Agent\\data",
  logFile: "C:\\ProgramData\\Zeeron\\Agent\\agent.log",
};

/** <Teg>qiymat</Teg> — barcha uchrashuvlar */
function tags(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}>([^<]*)</${name}>`, "g"))].map((m) => m[1]);
}

/** Teglar to'g'ri ochilib-yopilganmi (izohlar va <?xml?> hisobga olinmaydi) */
function assertBalanced(xml: string) {
  const stack: string[] = [];
  for (const m of xml.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "").matchAll(/<(\/?)([A-Za-z]+)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = m;
    if (selfClosing) continue;
    if (closing) assert.equal(stack.pop(), name, `</${name}> ochilmagan tegni yopyapti`);
    else stack.push(name);
  }
  assert.deepEqual(stack, [], "yopilmagan teglar qoldi");
}

test("Windows vazifasi: batareya, vaqt chegarasi va qayta ishga tushirish sozlamalari", () => {
  const xml = windowsTaskXml(winLayout);
  assertBalanced(xml);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-16"\?>/);

  // Kompyuter yonishi bilan (30 s kutib) + zaxira sifatida kirishda va har 5 daqiqada
  assert.match(xml, /<BootTrigger>\s*<Enabled>true<\/Enabled>\s*<Delay>PT30S<\/Delay>\s*<\/BootTrigger>/);
  assert.match(xml, /<LogonTrigger>\s*<Enabled>true<\/Enabled>\s*<\/LogonTrigger>/);
  assert.match(xml, /<TimeTrigger>[\s\S]*<Repetition>\s*<Interval>PT5M<\/Interval>\s*<StopAtDurationEnd>false<\/StopAtDurationEnd>\s*<\/Repetition>[\s\S]*<\/TimeTrigger>/);
  assert.deepEqual(tags(xml, "StartBoundary").length, 1);

  // SYSTEM, eng yuqori huquq
  assert.deepEqual(tags(xml, "UserId"), ["S-1-5-18"]);
  assert.deepEqual(tags(xml, "RunLevel"), ["HighestAvailable"]);

  // Standart sozlamalar aynan shu yerda bekor qilinadi
  assert.deepEqual(tags(xml, "DisallowStartIfOnBatteries"), ["false"]);
  assert.deepEqual(tags(xml, "StopIfGoingOnBatteries"), ["false"]);
  assert.deepEqual(tags(xml, "ExecutionTimeLimit"), ["PT0S"]);
  assert.deepEqual(tags(xml, "MultipleInstancesPolicy"), ["IgnoreNew"]);
  assert.deepEqual(tags(xml, "StartWhenAvailable"), ["true"]);
  assert.deepEqual(tags(xml, "Hidden"), ["true"]);
  assert.match(xml, /<RestartOnFailure>\s*<Interval>PT1M<\/Interval>\s*<Count>999<\/Count>\s*<\/RestartOnFailure>/);

  // Ishga tushiriladigan fayl
  assert.deepEqual(tags(xml, "Command"), [winLayout.binary]);
  assert.deepEqual(tags(xml, "Arguments"), ["--service"]);
  assert.deepEqual(tags(xml, "WorkingDirectory"), [winLayout.baseDir]);

  // Windows qator oxirlari
  assert.equal(xml.replace(/\r\n/g, "").includes("\n"), false);
});

test("Windows vazifasi: yo'ldagi maxsus belgilar XML'da qochiriladi", () => {
  const xml = windowsTaskXml({ ...winLayout, baseDir: "C:\\A & <B>", binary: "C:\\A & <B>\\zeeron-agent.exe" });
  assertBalanced(xml);
  assert.deepEqual(tags(xml, "Command"), ["C:\\A &amp; &lt;B&gt;\\zeeron-agent.exe"]);
  assert.deepEqual(tags(xml, "WorkingDirectory"), ["C:\\A &amp; &lt;B&gt;"]);
});

test("schtasks /XML uchun fayl UTF-16 LE, BOM bilan", () => {
  const xml = windowsTaskXml(winLayout);
  const buf = utf16WithBom(xml);
  assert.deepEqual([...buf.subarray(0, 2)], [0xff, 0xfe]);
  assert.equal(buf.subarray(2).toString("utf16le"), xml);
  // Izohlardagi "—" kabi ASCII bo'lmagan belgilar ham har biri 2 bayt
  assert.equal(buf.length, 2 + xml.length * 2);
});
