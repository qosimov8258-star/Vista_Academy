import type ExcelJS from "exceljs";

/**
 * To'lovlar hisobotining guruhlar bo'yicha Excel qismi — bog'chaning o'z
 * jadvali ("Tolovlar_guruhlar.xlsx") bilan bir xil ko'rinishda: 1-varaq
 * "Umumiy" (har guruh bir qator, guruh varaqlariga formula bilan
 * bog'langan), keyin har guruh alohida varaqda (Excel pastidagi tablardan
 * tanlanadi). Sariq sarlavha, holat rangli, pastda "JAMI" va sanoqlar.
 */

export type PayState = "To'langan" | "Qisman" | "To'lanmagan" | "Hisob yo'q";

export interface GroupChildRow {
  name: string;
  /** Shu davr uchun to'lanishi kerak (hisob-faktura, chegirma ayirilgan) — yo'q bo'lsa null */
  fee: number | null;
  /** Ustun nomi → summa (Naqd, Click, Terminal (karta), O'tkazma, Boshqa) */
  paid: Record<string, number>;
  /** "06.10.2026, 07.10.2026" */
  dates: string[];
  /** Kun/hafta hisobotida: oy bo'yicha qarz va holat (formula emas — ustunlarda faqat shu kunlar) */
  debt?: number | null;
  state?: PayState;
}

export interface GroupSheetData {
  name: string;
  children: GroupChildRow[];
}

export interface GroupsWorkbookInput {
  /** "Oktabr 2026", "13-oktabr 2026 (seshanba)" … */
  periodLabel: string;
  /** Oylik/to'liq: qarz va holat formula bilan (C − H); kun/hafta: tayyor qiymat */
  byFormula: boolean;
  /** Kun/hafta hisobotida varaq tepasida izoh */
  note?: string;
  methodColumns: string[];
  groups: GroupSheetData[];
  source: string;
}

const YELLOW = "FFFFE600";
const BORDER_COLOR = "FFA6A6A6";
export const STATE_FILL: Record<PayState, string> = {
  "To'langan": "FFE2F0D9",
  Qisman: "FFFFF2CC",
  "To'lanmagan": "FFFCE4E4",
  "Hisob yo'q": "FFEDEDED",
};
const NUM = "#,##0";
const METHOD_WIDTH: Record<string, number> = { Naqd: 13, Click: 13, "Terminal (karta)": 15, "O'tkazma": 12, Boshqa: 12 };

const thin = { style: "thin" as const, color: { argb: BORDER_COLOR } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

/** 1 → A, 27 → AA */
function col(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function stateOf(fee: number | null, paid: number): PayState {
  if (fee === null) return "Hisob yo'q";
  if (paid >= fee) return "To'langan";
  if (paid > 0) return "Qisman";
  return "To'lanmagan";
}

/** Excel varaq nomi: taqiqlangan belgilarsiz, 31 belgigacha, takrorlanmas */
function sheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[[\]:*?/\\]/g, "-").slice(0, 31).trim() || "Guruh";
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${base.slice(0, 28)} ${i}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

const ref = (sheet: string, cell: string) => `'${sheet.replace(/'/g, "''")}'!${cell}`;

function headRow(row: ExcelJS.Row) {
  row.height = 30;
  row.eachCell((c) => {
    c.font = { bold: true, size: 11 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border;
  });
}

export function addGroupSheets(wb: ExcelJS.Workbook, input: GroupsWorkbookInput, reservedNames: string[] = []) {
  const used = new Set(["umumiy", ...reservedNames.map((n) => n.toLowerCase())]);
  const M = input.methodColumns;
  const nM = M.length;
  // Guruh varag'i ustunlari: A №, B F.I.Sh., C Oylik to'lov, D… usullar, keyin Jami, Qarz, Holat, Sana, Izoh
  const cFee = 3;
  const cFirstM = 4;
  const cLastM = cFirstM + nM - 1;
  const cTotal = cLastM + 1;
  const cDebt = cTotal + 1;
  const cState = cDebt + 1;
  const cDates = cState + 1;
  const cNote = cDates + 1;

  const summary = wb.addWorksheet("Umumiy");
  const sheets: { name: string; n: number }[] = [];

  for (const g of input.groups) {
    const name = sheetName(g.name, used);
    const n = g.children.length;
    sheets.push({ name, n });
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });
    ws.columns = [5, 30, 13, ...M.map((m) => METHOD_WIDTH[m] ?? 12), 15, 13, 14, 20, 26].map((width) => ({ width }));

    const title = ws.getCell(1, 1);
    title.value = `${g.name.toUpperCase()} — ${input.periodLabel} to'lovlari`;
    title.font = { bold: true, size: 14 };
    ws.getRow(1).height = 18;
    if (input.note) {
      ws.getCell(2, 1).value = input.note;
      ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF595959" } };
    }

    const heads = ["№", "F.I.Sh.", "Oylik to'lov", ...M, "Jami to'langan", "Qarz", "Holat", "To'lov sanasi", "Izoh"];
    heads.forEach((h, i) => (ws.getCell(3, i + 1).value = h));
    headRow(ws.getRow(3));

    g.children.forEach((c, i) => {
      const r = 4 + i;
      const total = M.reduce((s, m) => s + (c.paid[m] ?? 0), 0);
      const state = c.state ?? stateOf(c.fee, total);
      const values: (ExcelJS.CellValue | undefined)[] = [];
      values[1] = i + 1;
      values[2] = c.name;
      values[cFee] = c.fee ?? null;
      M.forEach((m, k) => (values[cFirstM + k] = c.paid[m] ? c.paid[m] : null));
      values[cTotal] = { formula: `SUM(${col(cFirstM)}${r}:${col(cLastM)}${r})`, result: total };
      if (input.byFormula) {
        values[cDebt] = { formula: `IF(${col(cFee)}${r}="","",MAX(${col(cFee)}${r}-${col(cTotal)}${r},0))`, result: c.fee === null ? "" : Math.max(c.fee - total, 0) };
        values[cState] = {
          formula: `IF(${col(cFee)}${r}="","Hisob yo'q",IF(${col(cTotal)}${r}>=${col(cFee)}${r},"To'langan",IF(${col(cTotal)}${r}>0,"Qisman","To'lanmagan")))`,
          result: state,
        };
      } else {
        values[cDebt] = c.debt ?? null;
        values[cState] = state;
      }
      values[cDates] = c.dates.join(", ") || null;
      values[cNote] = null;
      const row = ws.getRow(r);
      for (let k = 1; k <= cNote; k++) {
        const cell = row.getCell(k);
        cell.value = (values[k] ?? null) as ExcelJS.CellValue;
        cell.font = { size: 11 };
        cell.border = border;
        if (k >= cFee && k <= cDebt) cell.numFmt = NUM;
      }
      row.getCell(cState).fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATE_FILL[state] } };
    });

    // JAMI
    const last = 3 + n;
    const jr = 4 + n;
    ws.getCell(jr, 2).value = "JAMI";
    ws.getCell(jr, 2).font = { bold: true };
    for (let k = cFee; k <= cDebt; k++) {
      const cell = ws.getCell(jr, k);
      const L = col(k);
      const result = g.children.reduce((s, c) => {
        const total = M.reduce((t, m) => t + (c.paid[m] ?? 0), 0);
        if (k === cFee) return s + (c.fee ?? 0);
        if (k === cTotal) return s + total;
        if (k === cDebt) return s + (input.byFormula ? (c.fee === null ? 0 : Math.max(c.fee - total, 0)) : (c.debt ?? 0));
        return s + (c.paid[M[k - cFirstM]] ?? 0);
      }, 0);
      cell.value = n ? { formula: `SUM(${L}4:${L}${last})`, result } : 0;
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
      cell.numFmt = NUM;
      cell.border = border;
    }

    // Sanoqlar
    const S = col(cState);
    const counts: [string, string, number][] = [
      ["Bolalar soni", `COUNTA(B4:B${last})`, n],
      ["To'laganlar", `COUNTIF(${S}4:${S}${last},"To'langan")`, 0],
      ["Qisman to'laganlar", `COUNTIF(${S}4:${S}${last},"Qisman")`, 0],
      ["To'lamaganlar", `COUNTIF(${S}4:${S}${last},"To'lanmagan")`, 0],
      ["Hisob yo'q", `COUNTIF(${S}4:${S}${last},"Hisob yo'q")`, 0],
    ];
    const states = g.children.map((c) => c.state ?? stateOf(c.fee, M.reduce((t, m) => t + (c.paid[m] ?? 0), 0)));
    counts[1][2] = states.filter((s) => s === "To'langan").length;
    counts[2][2] = states.filter((s) => s === "Qisman").length;
    counts[3][2] = states.filter((s) => s === "To'lanmagan").length;
    counts[4][2] = states.filter((s) => s === "Hisob yo'q").length;
    counts.forEach(([label, formula, result], i) => {
      ws.getCell(6 + n + i, 2).value = label;
      const c = ws.getCell(6 + n + i, 3);
      c.value = n ? { formula, result } : 0;
      c.font = { bold: true };
    });
  }

  // ------------------------------------------------------------ Umumiy
  const sCols = ["Guruh", "Bolalar", "Oylik to'lov", ...M, "Jami to'langan", "Qarz", "To'laganlar", "Qisman", "To'lamagan", "Hisob yo'q", "Foiz"];
  summary.columns = [14, 9, 14, ...M.map((m) => METHOD_WIDTH[m] ?? 12), 15, 13, 11, 9, 11, 10, 8].map((width) => ({ width }));
  summary.getCell(1, 1).value = `Guruhlar bo'yicha umumiy — ${input.periodLabel}`;
  summary.getCell(1, 1).font = { bold: true, size: 14 };
  summary.getRow(1).height = 18;
  if (input.note) {
    summary.getCell(2, 1).value = input.note;
    summary.getCell(2, 1).font = { italic: true, size: 10, color: { argb: "FF595959" } };
  }
  sCols.forEach((h, i) => (summary.getCell(3, i + 1).value = h));
  headRow(summary.getRow(3));

  // Umumiy ustunlari → guruh varag'idagi katak
  const sFee = 3;
  const sTotal = 3 + nM + 1;
  const sCountFirst = sTotal + 2;
  const sPct = sCountFirst + 4;
  sheets.forEach((s, i) => {
    const r = 4 + i;
    const g = input.groups[i];
    const jr = 4 + s.n;
    const row = summary.getRow(r);
    row.getCell(1).value = g.name;
    row.getCell(2).value = { formula: ref(s.name, `C${6 + s.n}`), result: s.n };
    const totals: number[] = [];
    for (let k = cFee; k <= cDebt; k++) {
      const sheetCell = sheetOf(s.name).getCell(jr, k).value as { result?: number } | number;
      const result = typeof sheetCell === "number" ? sheetCell : Number(sheetCell?.result ?? 0);
      totals.push(result);
      row.getCell(sFee + (k - cFee)).value = { formula: ref(s.name, `${col(k)}${jr}`), result };
    }
    for (let j = 0; j < 4; j++) {
      const c = sheetOf(s.name).getCell(7 + s.n + j, 3).value as { result?: number } | number;
      row.getCell(sCountFirst + j).value = { formula: ref(s.name, `C${7 + s.n + j}`), result: typeof c === "number" ? c : Number(c?.result ?? 0) };
    }
    const fee = totals[0];
    const paid = totals[cTotal - cFee];
    row.getCell(sPct).value = { formula: `IF(${col(sFee)}${r}=0,0,${col(sTotal)}${r}/${col(sFee)}${r})`, result: fee ? paid / fee : 0 };
    for (let k = 1; k <= sPct; k++) {
      const cell = row.getCell(k);
      cell.font = { size: 11 };
      cell.border = border;
      if (k >= sFee && k < sCountFirst) cell.numFmt = NUM;
    }
    row.getCell(sPct).numFmt = "0%";
  });

  const first = 4;
  const lastRow = 3 + sheets.length;
  const jr = lastRow + 1;
  summary.getCell(jr, 1).value = "JAMI";
  summary.getCell(jr, 1).font = { bold: true, size: 11 };
  const colSum = (k: number) => {
    let s = 0;
    for (let r = first; r <= lastRow; r++) {
      const v = summary.getCell(r, k).value as { result?: number } | number | null;
      s += typeof v === "number" ? v : Number(v?.result ?? 0);
    }
    return s;
  };
  for (let k = 2; k <= sPct; k++) {
    const cell = summary.getCell(jr, k);
    const L = col(k);
    if (k === sPct) {
      const fee = colSum(sFee);
      cell.value = { formula: `IF(${col(sFee)}${jr}=0,0,${col(sTotal)}${jr}/${col(sFee)}${jr})`, result: fee ? colSum(sTotal) / fee : 0 };
      cell.numFmt = "0%";
    } else {
      cell.value = sheets.length ? { formula: `SUM(${L}${first}:${L}${lastRow})`, result: colSum(k) } : 0;
      if (k >= sFee && k < sCountFirst) cell.numFmt = NUM;
    }
    cell.font = { bold: true, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
    cell.border = border;
  }
  const src = summary.getCell(jr + 2, 1);
  src.value = input.source;
  src.font = { italic: true, size: 11, color: { argb: "FF595959" } };

  function sheetOf(name: string) {
    return wb.getWorksheet(name)!;
  }
}
