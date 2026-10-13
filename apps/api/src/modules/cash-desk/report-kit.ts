import { BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

/**
 * Kassa hisobotlari (to'lovlar, xarajatlar) uchun umumiy qismlar: davrni
 * tekshirish va nomlash, Excel uslubi va PDF jadvallari. Har hisobot o'z
 * rangida, lekin bir xil ko'rinishda chiqadi.
 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportKind = "day" | "week" | "month" | "all";
export type ReportFormat = "xlsx" | "pdf";

export const METHOD_ORDER = ["CASH", "CARD", "BANK_TRANSFER", "CLICK", "PAYME", "UZUM", "MOBILE_APP", "BANKOMAT", "OTHER"] as const;
export const METHOD_UZ: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  BANK_TRANSFER: "O'tkazma",
  CLICK: "Click",
  PAYME: "Payme",
  UZUM: "Uzum",
  MOBILE_APP: "Ilova",
  BANKOMAT: "Bankomat",
  OTHER: "Boshqa",
};
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
export const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

const tashkent = (d: Date) => new Date(d.getTime() + TASHKENT_OFFSET_MS);
export const dayOf = (d: Date) => tashkent(d).toISOString().slice(0, 10);
export const timeOf = (d: Date) => tashkent(d).toISOString().slice(11, 16);
export const sum = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** Standart PDF shrifti faqat lotin harflarini biladi — o'zbekcha tutuq belgilari oddiy apostrofga */
export const plain = (s: string) => s.replace(/[ʻʼ‘’`´]/g, "'").replace(/[“”]/g, '"');
export const weekday = (day: string) => WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];

export function dayLabel(day: string, withYear = true) {
  const [y, m, d] = day.split("-").map(Number);
  return `${d}-${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}
export function periodName(period: string) {
  const [y, m] = period.split("-").map(Number);
  const name = MONTHS[m - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** So'rov parametrlarini tekshiradi (xato bo'lsa — 400) */
export function checkReportParams(kind: ReportKind, from: string | undefined, to: string | undefined, format: ReportFormat) {
  if (!["day", "week", "month", "all"].includes(kind)) throw new BadRequestException("Hisobot turi noto'g'ri");
  if (!["xlsx", "pdf"].includes(format)) throw new BadRequestException("Fayl turi noto'g'ri");
  if (kind !== "all" && (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to)) {
    throw new BadRequestException("Davr noto'g'ri (YYYY-MM-DD)");
  }
}

/** "13-oktabr 2026 (seshanba)", "6 — 12-oktabr 2026 (hafta)", "Oktabr 2026", "To'liq: …" */
export function periodLabelOf(kind: ReportKind, from: string | undefined, to: string | undefined, firstDay?: string, lastDay?: string) {
  if (kind === "day") return `${dayLabel(from!)} (${weekday(from!).toLowerCase()})`;
  if (kind === "week") return `${dayLabel(from!, false)} — ${dayLabel(to!)} (hafta)`;
  if (kind === "month") return periodName(from!.slice(0, 7));
  return firstDay ? `To'liq: ${dayLabel(firstDay)} — ${dayLabel(lastDay!)}` : "To'liq";
}

/** Fayl nomidagi davr: "toliq", "2026-10", "2026-10-13" yoki "2026-10-06_2026-10-12" */
export function stampOf(kind: ReportKind, from: string | undefined, to: string | undefined) {
  return kind === "all" ? "toliq" : kind === "month" ? from!.slice(0, 7) : from === to ? from! : `${from}_${to}`;
}

export function reportFile(buffer: Buffer, prefix: string, stamp: string, format: ReportFormat) {
  return {
    buffer,
    filename: `${prefix}-${stamp}.${format}`,
    contentType: format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
  };
}

export interface ReportHead {
  organization: string;
  branch: string;
  periodLabel: string;
  generatedAt: string;
  generatedBy: string;
}

export function generatedStamp() {
  const now = new Date();
  return `${dayLabel(dayOf(now))}, ${timeOf(now)}`;
}

// ------------------------------------------------------------------ Excel

export const MONEY = '#,##0" so\'m"';

/** Hisobot rangi: `accent` — sarlavha va jadval boshi, `light` — "Jami" qatori foni */
export interface ReportTheme {
  accent: string;
  light: string;
}

export function excelKit(d: ReportHead, theme: ReportTheme) {
  const accent = `FF${theme.accent.slice(1).toUpperCase()}`;
  const light = `FF${theme.light.slice(1).toUpperCase()}`;
  const head = (row: ExcelJS.Row) => {
    row.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = { bottom: { style: "thin", color: { argb: light } } };
    });
    row.height = 22;
  };
  const totalRow = (row: ExcelJS.Row) => {
    row.eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: light } };
      c.border = { top: { style: "thin", color: { argb: accent } } };
    });
  };
  const titleBlock = (ws: ExcelJS.Worksheet, title: string, cols: number) => {
    ws.mergeCells(1, 1, 1, cols);
    const t = ws.getCell(1, 1);
    t.value = `${d.organization} — ${title}`;
    t.font = { bold: true, size: 15, color: { argb: accent } };
    ws.mergeCells(2, 1, 2, cols);
    ws.getCell(2, 1).value = `${d.branch} · ${d.periodLabel}`;
    ws.getCell(2, 1).font = { size: 11, color: { argb: "FF555555" } };
    ws.addRow([]);
  };
  const section = (ws: ExcelJS.Worksheet, title: string) => {
    ws.addRow([title]).font = { bold: true, color: { argb: accent } };
  };
  /** Umumiy varaqdagi "nom — qiymat" qatorlari; `money` — pul formatidagilar, `big` — katta yoziladigani */
  const info = (ws: ExcelJS.Worksheet, rows: [string, string | number][], money: string[], big: string, mergeTo: number) => {
    for (const [k, v] of rows) {
      const r = ws.addRow([k, v]);
      r.getCell(1).font = { color: { argb: "FF6D6D72" } };
      r.getCell(2).font = { bold: true, size: k === big ? 14 : 11 };
      r.getCell(2).alignment = { horizontal: "left" };
      if (money.includes(k)) r.getCell(2).numFmt = MONEY;
      ws.mergeCells(r.number, 2, r.number, mergeTo);
    }
  };
  const zebra = (row: ExcelJS.Row, i: number) => {
    if (i % 2 === 1) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F9" } }));
  };
  return { head, totalRow, titleBlock, section, info, zebra };
}

// ------------------------------------------------------------------ PDF

export type PdfCol = { title: string; width: number; align?: "left" | "right" | "center" };

/**
 * A4 PDF hisobot: sarlavha, ko'rsatkich kartalari, jadvallar (sahifaga
 * sig'maganda sarlavhasi bilan keyingi sahifaga o'tadi) va pastda sahifa
 * raqamlari. `finish()` tayyor faylni qaytaradi.
 */
export function pdfKit(d: ReportHead, title: string, theme: ReportTheme) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true, info: { Title: plain(`${title} — ${d.periodLabel}`) } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const GRAY = "#6d6d72";
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 14;

  // Sarlavha
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111").text(plain(d.organization), left, 40);
  doc.font("Helvetica").fontSize(10).fillColor(GRAY).text(plain(d.branch));
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(15).fillColor(theme.accent).text(plain(title));
  doc.font("Helvetica").fontSize(10.5).fillColor("#111").text(plain(d.periodLabel));
  doc.fontSize(8.5).fillColor(GRAY).text(plain(`Tuzildi: ${d.generatedAt} · ${d.generatedBy}`));
  doc.moveDown(0.8);

  /** Ko'rsatkich kartalari (4 ta, birinchisi rangli) */
  const cards = (items: [string, string][]) => {
    const gap = 8;
    const cw = (width - gap * (items.length - 1)) / items.length;
    const cy = doc.y;
    items.forEach(([label, value], i) => {
      const x = left + i * (cw + gap);
      doc.roundedRect(x, cy, cw, 52, 8).fill(i === 0 ? theme.light : "#f2f2f7");
      doc.font("Helvetica").fontSize(8.5).fillColor(GRAY).text(plain(label), x + 10, cy + 9, { width: cw - 20 });
      doc.font("Helvetica-Bold").fontSize(i === 0 ? 13 : 12).fillColor(i === 0 ? theme.accent : "#111").text(plain(value), x + 10, cy + 26, { width: cw - 20 });
    });
    doc.y = cy + 66;
  };

  /** Kartalar ostidagi bir qatorli izoh (masalan, o'tgan davr bilan solishtirish) */
  const note = (text: string) => {
    doc.font("Helvetica").fontSize(9).fillColor(GRAY).text(plain(text), left, doc.y - 6, { width });
    doc.moveDown(0.9);
  };

  const table = (tableTitle: string, cols: PdfCol[], rows: string[][], total?: string[]) => {
    const scale = width / cols.reduce((s, c) => s + c.width, 0);
    const ws = cols.map((c) => c.width * scale);
    const rowH = 18;
    const drawHead = () => {
      const y = doc.y;
      doc.rect(left, y, width, rowH).fill(theme.accent);
      let x = left;
      cols.forEach((c, i) => {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#fff").text(plain(c.title), x + 5, y + 5, { width: ws[i] - 10, align: c.align ?? "left", lineBreak: false, ellipsis: true });
        x += ws[i];
      });
      doc.y = y + rowH;
    };
    if (doc.y + 60 > bottom()) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text(plain(tableTitle), left, doc.y);
    doc.moveDown(0.3);
    drawHead();
    // `keep` — shu qator bilan birga sig'ishi kerak bo'lgan qatorlar soni (oxirgi qator + Jami ajralmasin)
    const drawRow = (cells: string[], i: number, bold = false, keep = 1) => {
      if (doc.y + rowH * keep > bottom()) {
        doc.addPage();
        drawHead();
      }
      const y = doc.y;
      if (bold) doc.rect(left, y, width, rowH).fill(theme.light);
      else if (i % 2 === 1) doc.rect(left, y, width, rowH).fill("#f7f7f9");
      let x = left;
      cells.forEach((cell, j) => {
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor("#111").text(plain(cell), x + 5, y + 5, { width: ws[j] - 10, align: cols[j].align ?? "left", lineBreak: false, ellipsis: true });
        x += ws[j];
      });
      doc.y = y + rowH;
    };
    rows.forEach((r, i) => drawRow(r, i, false, total && i === rows.length - 1 ? 2 : 1));
    if (total) drawRow(total, 0, true);
    doc.moveDown(1);
  };

  const empty = (text: string) => {
    doc.font("Helvetica").fontSize(11).fillColor(GRAY).text(plain(text), left, doc.y);
  };

  const finish = () => {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Pastki chegara ostiga yozilganda pdfkit yangi sahifa ochmasin
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(8).fillColor(GRAY).text(plain(`${d.organization} · ${title} · ${d.periodLabel}`), left, doc.page.height - 30, { width: width - 80, lineBreak: false });
      doc.text(`${i - range.start + 1} / ${range.count}`, left + width - 80, doc.page.height - 30, { width: 80, align: "right", lineBreak: false });
    }
    doc.end();
    return done;
  };

  return { cards, note, table, empty, finish };
}
