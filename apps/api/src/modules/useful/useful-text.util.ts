import { BadRequestException } from "@nestjs/common";

/**
 * Tarbiyachi she'r/ertak matnini oddiy `textarea`ga yozadi — bandlar
 * (yoki xatboshilar) va qatorlarni server ajratadi, shu bilan bitta qoida
 * ikki joyda (frontend + backend) takrorlanmaydi.
 *
 * Qoida: `\r\n` -> `\n`; har qator `trim()`; bir yoki bir necha bo'sh qator —
 * yangi band/xatboshi; bo'sh bandlar tashlab yuboriladi.
 */
function splitIntoBlocks(rawText: string): string[][] {
  const normalized = rawText.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n").map((line) => line.trim());

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
  if (current.length > 0) {
    blocks.push(current);
  }
  return blocks;
}

export const POEM_MAX_STANZAS = 12;
export const POEM_MIN_TOTAL_LINES = 2;
export const POEM_MAX_TOTAL_LINES = 60;
export const POEM_MAX_LINE_LENGTH = 60;

/** She'r matnini bandlarga ajratadi va validatsiya qiladi. `stanzas` uchun tayyor. */
export function parsePoemStanzas(text: string): string[][] {
  const stanzas = splitIntoBlocks(text);
  if (stanzas.length < 1 || stanzas.length > POEM_MAX_STANZAS) {
    throw new BadRequestException(`She'r 1–${POEM_MAX_STANZAS} banddan iborat bo'lishi kerak`);
  }
  const totalLines = stanzas.reduce((sum, stanza) => sum + stanza.length, 0);
  if (totalLines < POEM_MIN_TOTAL_LINES || totalLines > POEM_MAX_TOTAL_LINES) {
    throw new BadRequestException(
      `She'r jami ${POEM_MIN_TOTAL_LINES}–${POEM_MAX_TOTAL_LINES} qatordan iborat bo'lishi kerak`,
    );
  }
  for (const stanza of stanzas) {
    for (const line of stanza) {
      if (line.length > POEM_MAX_LINE_LENGTH) {
        throw new BadRequestException(`Har bir qator ${POEM_MAX_LINE_LENGTH} belgidan oshmasligi kerak: "${line}"`);
      }
    }
  }
  return stanzas;
}

export const TALE_MAX_PARAGRAPHS = 40;
export const TALE_MAX_TOTAL_LENGTH = 8000;

/** Ertak matnini xatboshilarga ajratadi va validatsiya qiladi. `paragraphs` uchun tayyor. */
export function parseTaleParagraphs(text: string): string[] {
  const blocks = splitIntoBlocks(text);
  // Bitta xatboshi ichidagi qatorlar bir joyga — matn oqimi buzilmasin (she'rdan farqli, satr bo'linishi shart emas).
  const paragraphs = blocks.map((block) => block.join(" "));
  if (paragraphs.length < 1 || paragraphs.length > TALE_MAX_PARAGRAPHS) {
    throw new BadRequestException(`Ertak 1–${TALE_MAX_PARAGRAPHS} xatboshidan iborat bo'lishi kerak`);
  }
  const totalLength = paragraphs.reduce((sum, p) => sum + p.length, 0);
  if (totalLength > TALE_MAX_TOTAL_LENGTH) {
    throw new BadRequestException(`Ertak matni jami ${TALE_MAX_TOTAL_LENGTH} belgidan oshmasligi kerak`);
  }
  return paragraphs;
}

/** `minutes` berilmasa — ovoz chiqarib o'qish tezligiga (~120 so'z/daq) qarab hisoblanadi. */
export function estimateReadingMinutes(paragraphs: string[]): number {
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 120));
}
