/**
 * Bandlarga/xatboshilarga ajratishning mijoz tomonidagi ko'rinishi — faqat
 * jonli ko'rinish (preview) uchun. Haqiqiy saqlash serverda bo'ladi
 * (`apps/api/src/modules/useful/useful-text.util.ts`), qoida ikkalasida
 * bir xil: `\r\n` -> `\n`, har qator trim, bo'sh qator(lar) — yangi band.
 */
export function splitIntoBlocks(rawText: string): string[][] {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim());
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.length === 0) {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}
