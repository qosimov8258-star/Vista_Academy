import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, requireMoneyScope, toTenantScope } from "../iam/tenant-auth.types";
import {
  DAY_MS,
  METHOD_ORDER,
  METHOD_UZ,
  MONEY,
  checkReportParams,
  dayLabel,
  excelKit,
  generatedStamp,
  pdfKit,
  periodLabelOf,
  periodName,
  reportFile,
  stampOf,
  sum,
  timeOf,
  weekday,
  type ReportFormat,
  type ReportHead,
  type ReportKind,
  type ReportTheme,
} from "./report-kit";

const THEME: ReportTheme = { accent: "#b45309", light: "#fdf1e4" };

interface Row {
  day: string;
  time: string;
  category: string;
  note: string;
  method: string;
  amount: number;
  createdBy: string;
  hasReceipt: boolean;
}

interface ReportData extends ReportHead {
  rows: Row[];
  total: number;
  cashTotal: number;
  /** Naqddan boshqa usulda to'langan, lekin chek surati yo'q xarajatlar soni */
  missingReceipts: number;
  biggest: Row | null;
  /** O'tgan shunday davr bilan solishtirish (to'liq hisobotda yo'q) */
  previous: { label: string; total: number } | null;
  byCategory: { category: string; count: number; total: number }[];
  byMethod: { method: string; count: number; total: number }[];
  byDay: { day: string; count: number; total: number; methods: Record<string, number>; categories: Record<string, number> }[];
  dayMethods: string[];
}

const shiftDay = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** Oldingi shunday davr: kecha, o'tgan hafta yoki o'tgan oy */
function previousRange(kind: ReportKind, from: string, to: string) {
  if (kind === "day") return { from: shiftDay(from, -1), to: shiftDay(to, -1), label: dayLabel(shiftDay(from, -1)) };
  if (kind === "week") return { from: shiftDay(from, -7), to: shiftDay(to, -7), label: "o'tgan hafta" };
  const [y, m] = from.slice(0, 7).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 2, 1));
  const end = new Date(Date.UTC(y, m - 1, 0));
  const period = start.toISOString().slice(0, 7);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: periodName(period) };
}

/**
 * Xarajatlar hisoboti (Excel va PDF): tanlangan davrdagi chiqimlar — jami,
 * naqd va boshqa usuldagi qismi, o'tgan davr bilan solishtirish, turkumlar,
 * usullar va kunlar bo'yicha, batafsil ro'yxat (chek bor-yo'qligi bilan).
 */
@Injectable()
export class ExpensesReportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(caller: TenantAuthenticatedUser, kind: ReportKind, from: string | undefined, to: string | undefined, format: ReportFormat) {
    const branchId = requireMoneyScope(toTenantScope(caller));
    checkReportParams(kind, from, to, format);

    const prev = kind === "all" ? null : previousRange(kind, from!, to!);
    const [branch, expenses, prevAgg] = await Promise.all([
      this.prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { name: true, organization: { select: { name: true } } } }),
      this.prisma.expense.findMany({
        where: { branchId, ...(kind === "all" ? {} : { date: { gte: asDate(from!), lte: asDate(to!) } }) },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { date: true, amount: true, category: true, method: true, note: true, createdByName: true, receiptMimeType: true, createdAt: true },
      }),
      prev
        ? this.prisma.expense.aggregate({ where: { branchId, date: { gte: asDate(prev.from), lte: asDate(prev.to) } }, _sum: { amount: true } })
        : Promise.resolve(null),
    ]);

    const rows: Row[] = expenses.map((e) => ({
      day: e.date.toISOString().slice(0, 10),
      time: timeOf(e.createdAt),
      category: e.category,
      note: e.note ?? "",
      method: e.method,
      amount: Number(e.amount),
      createdBy: e.createdByName,
      hasReceipt: !!e.receiptMimeType,
    }));
    const total = rows.reduce((s, r) => s + r.amount, 0);

    const categories = new Map<string, { count: number; total: number }>();
    const days = new Map<string, { count: number; total: number; methods: Record<string, number>; categories: Record<string, number> }>();
    for (const r of rows) {
      const c = categories.get(r.category) ?? { count: 0, total: 0 };
      c.count += 1;
      c.total += r.amount;
      categories.set(r.category, c);
      const d = days.get(r.day) ?? { count: 0, total: 0, methods: {}, categories: {} };
      d.count += 1;
      d.total += r.amount;
      d.methods[r.method] = (d.methods[r.method] ?? 0) + r.amount;
      d.categories[r.category] = (d.categories[r.category] ?? 0) + r.amount;
      days.set(r.day, d);
    }
    const byMethod = METHOD_ORDER.map((m) => {
      const xs = rows.filter((r) => r.method === m);
      return { method: m as string, count: xs.length, total: xs.reduce((s, r) => s + r.amount, 0) };
    }).filter((x) => x.count > 0);

    const data: ReportData = {
      organization: branch.organization.name,
      branch: branch.name,
      periodLabel: periodLabelOf(kind, from, to, rows[0]?.day, rows[rows.length - 1]?.day),
      generatedAt: generatedStamp(),
      generatedBy: caller.fullName,
      rows,
      total,
      cashTotal: rows.filter((r) => r.method === "CASH").reduce((s, r) => s + r.amount, 0),
      missingReceipts: rows.filter((r) => r.method !== "CASH" && !r.hasReceipt).length,
      biggest: rows.reduce<Row | null>((b, r) => (!b || r.amount > b.amount ? r : b), null),
      previous: prev ? { label: prev.label, total: Number(prevAgg?._sum.amount ?? 0) } : null,
      byCategory: [...categories.entries()].map(([category, c]) => ({ category, ...c })).sort((a, b) => b.total - a.total),
      byMethod,
      byDay: [...days.entries()].map(([day, d]) => ({ day, ...d })).sort((a, b) => a.day.localeCompare(b.day)),
      dayMethods: byMethod.map((m) => m.method),
    };

    const buffer = format === "xlsx" ? await this.excel(data) : await this.pdf(data);
    return reportFile(buffer, "xarajatlar-hisoboti", stampOf(kind, from, to), format);
  }

  /** "o'tgan hafta: 1 200 000 so'm (+12%)" */
  private comparison(d: ReportData) {
    if (!d.previous) return null;
    const p = d.previous.total;
    const change = p > 0 ? Math.round(((d.total - p) / p) * 100) : null;
    return `${d.previous.label}: ${sum(p)} so'm${change !== null ? ` (${change > 0 ? "+" : ""}${change}%)` : ""}`;
  }

  private receiptLabel(r: Row) {
    return r.method === "CASH" ? "—" : r.hasReceipt ? "bor" : "yo'q";
  }

  // ------------------------------------------------------------------ Excel

  private async excel(d: ReportData): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = d.generatedBy;
    wb.created = new Date();
    const { head, totalRow, titleBlock, section, info, zebra } = excelKit(d, THEME);
    const count = d.rows.length;

    // 1. Umumiy
    const ws = wb.addWorksheet("Umumiy", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 30 }, { width: 14 }, { width: 14 }, { width: 22 }];
    titleBlock(ws, "Xarajatlar hisoboti", 4);
    const comparison = this.comparison(d);
    info(
      ws,
      [
        ["Davr", d.periodLabel],
        ["Hisobot tuzildi", `${d.generatedAt} (${d.generatedBy})`],
        ["Jami xarajat", d.total],
        ["Xarajatlar soni", count],
        ["Naqd (kassadan)", d.cashTotal],
        ["Boshqa usulda", d.total - d.cashTotal],
        ["O'rtacha xarajat", count ? Math.round(d.total / count) : 0],
        ...(d.biggest ? [["Eng katta xarajat", `${sum(d.biggest.amount)} so'm · ${d.biggest.category} · ${dayLabel(d.biggest.day)}`] as [string, string]] : []),
        ...(comparison ? [["O'tgan davr", comparison] as [string, string]] : []),
        ...(d.missingReceipts ? [["Chek surati yo'q", `${d.missingReceipts} ta (naqddan boshqa usulda)`] as [string, string]] : []),
      ],
      ["Jami xarajat", "Naqd (kassadan)", "Boshqa usulda", "O'rtacha xarajat"],
      "Jami xarajat",
      4,
    );
    ws.addRow([]);
    section(ws, "TURKUMLAR BO'YICHA");
    head(ws.addRow(["Turkum", "Soni", "Ulushi", "Summa"]));
    for (const c of d.byCategory) {
      const r = ws.addRow([c.category, c.count, d.total ? c.total / d.total : 0, c.total]);
      r.getCell(3).numFmt = "0.0%";
      r.getCell(4).numFmt = MONEY;
    }
    const ct = ws.addRow(["Jami", count, d.total ? 1 : 0, d.total]);
    ct.getCell(3).numFmt = "0.0%";
    ct.getCell(4).numFmt = MONEY;
    totalRow(ct);
    ws.addRow([]);
    section(ws, "TO'LOV USULLARI");
    head(ws.addRow(["Usul", "Soni", "Ulushi", "Summa"]));
    for (const m of d.byMethod) {
      const r = ws.addRow([METHOD_UZ[m.method], m.count, d.total ? m.total / d.total : 0, m.total]);
      r.getCell(3).numFmt = "0.0%";
      r.getCell(4).numFmt = MONEY;
    }
    const mt = ws.addRow(["Jami", count, d.total ? 1 : 0, d.total]);
    mt.getCell(3).numFmt = "0.0%";
    mt.getCell(4).numFmt = MONEY;
    totalRow(mt);

    // 2. Kunlar bo'yicha (usullar kesimida)
    const wd = wb.addWorksheet("Kunlar bo'yicha", { views: [{ state: "frozen", ySplit: 4, showGridLines: false }] });
    const dcols = ["Sana", "Hafta kuni", "Soni", ...d.dayMethods.map((m) => METHOD_UZ[m]), "Jami"];
    wd.columns = dcols.map((_, i) => ({ width: i === 0 ? 16 : i === 1 ? 13 : i === 2 ? 8 : 16 }));
    titleBlock(wd, "Kunlar bo'yicha", dcols.length);
    head(wd.addRow(dcols));
    for (const day of d.byDay) {
      const r = wd.addRow([dayLabel(day.day), weekday(day.day), day.count, ...d.dayMethods.map((m) => day.methods[m] ?? 0), day.total]);
      for (let i = 4; i <= dcols.length; i++) r.getCell(i).numFmt = MONEY;
    }
    const dt = wd.addRow(["Jami", "", count, ...d.byMethod.map((m) => m.total), d.total]);
    for (let i = 4; i <= dcols.length; i++) dt.getCell(i).numFmt = MONEY;
    totalRow(dt);

    // 3. Turkumlar × kunlar
    if (d.byCategory.length > 1 && d.byDay.length > 1) {
      const wm = wb.addWorksheet("Turkumlar va kunlar", { views: [{ state: "frozen", ySplit: 4, xSplit: 1, showGridLines: false }] });
      const cats = d.byCategory.map((c) => c.category);
      const mcols = ["Sana", ...cats, "Jami"];
      wm.columns = mcols.map((_, i) => ({ width: i === 0 ? 16 : 15 }));
      titleBlock(wm, "Turkumlar va kunlar", mcols.length);
      head(wm.addRow(mcols));
      for (const day of d.byDay) {
        const r = wm.addRow([dayLabel(day.day), ...cats.map((c) => day.categories[c] ?? null), day.total]);
        for (let i = 2; i <= mcols.length; i++) r.getCell(i).numFmt = MONEY;
      }
      const mtot = wm.addRow(["Jami", ...d.byCategory.map((c) => c.total), d.total]);
      for (let i = 2; i <= mcols.length; i++) mtot.getCell(i).numFmt = MONEY;
      totalRow(mtot);
    }

    // 4. Xarajatlar (batafsil)
    const wx = wb.addWorksheet("Xarajatlar", { views: [{ state: "frozen", ySplit: 4 }] });
    const xcols = ["№", "Sana", "Hafta kuni", "Turkum", "Izoh", "Usul", "Summa", "Chek", "Kim yozdi", "Yozilgan vaqt"];
    wx.columns = [5, 16, 12, 18, 36, 11, 16, 8, 20, 12].map((width) => ({ width }));
    titleBlock(wx, "Xarajatlar ro'yxati", xcols.length);
    head(wx.addRow(xcols));
    d.rows.forEach((r, i) => {
      const row = wx.addRow([i + 1, dayLabel(r.day), weekday(r.day), r.category, r.note, METHOD_UZ[r.method] ?? r.method, r.amount, this.receiptLabel(r), r.createdBy, r.time]);
      row.getCell(7).numFmt = MONEY;
      row.getCell(5).alignment = { wrapText: true, vertical: "top" };
      zebra(row, i);
    });
    const xt = wx.addRow(["", "", "", "Jami", `${count} ta`, "", d.total]);
    xt.getCell(7).numFmt = MONEY;
    totalRow(xt);
    wx.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: xcols.length } };

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ------------------------------------------------------------------ PDF

  private pdf(d: ReportData): Promise<Buffer> {
    const { cards, note, table, empty, finish } = pdfKit(d, "Xarajatlar hisoboti", THEME);
    const count = d.rows.length;

    cards([
      ["Jami xarajat", `${sum(d.total)} so'm`],
      ["Xarajatlar soni", `${count} ta`],
      ["Naqd (kassadan)", `${sum(d.cashTotal)} so'm`],
      ["Boshqa usulda", `${sum(d.total - d.cashTotal)} so'm`],
    ]);
    const extra = [
      this.comparison(d) ? `O'tgan davr — ${this.comparison(d)}` : null,
      d.biggest ? `Eng katta: ${sum(d.biggest.amount)} so'm (${d.biggest.category}, ${dayLabel(d.biggest.day, false)})` : null,
      d.missingReceipts ? `Chek surati yo'q: ${d.missingReceipts} ta` : null,
    ].filter(Boolean);
    if (extra.length) note(extra.join("   ·   "));

    const pct = (v: number) => (d.total ? `${((v / d.total) * 100).toFixed(1)}%` : "0%");
    if (count) {
      table(
        "Turkumlar bo'yicha",
        [{ title: "Turkum", width: 3 }, { title: "Soni", width: 1.2, align: "right" }, { title: "Ulushi", width: 1.4, align: "right" }, { title: "Summa", width: 2.4, align: "right" }],
        d.byCategory.map((c) => [c.category, String(c.count), pct(c.total), `${sum(c.total)} so'm`]),
        ["Jami", String(count), d.total ? "100%" : "0%", `${sum(d.total)} so'm`],
      );
      table(
        "To'lov usullari",
        [{ title: "Usul", width: 3 }, { title: "Soni", width: 1.2, align: "right" }, { title: "Ulushi", width: 1.4, align: "right" }, { title: "Summa", width: 2.4, align: "right" }],
        d.byMethod.map((m) => [METHOD_UZ[m.method], String(m.count), pct(m.total), `${sum(m.total)} so'm`]),
        ["Jami", String(count), d.total ? "100%" : "0%", `${sum(d.total)} so'm`],
      );
    }
    if (d.byDay.length > 1) {
      const methods = d.dayMethods.slice(0, 4);
      const rest = d.dayMethods.slice(4);
      table(
        "Kunlar bo'yicha",
        [
          { title: "Sana", width: 2.4 },
          { title: "Soni", width: 0.9, align: "right" },
          ...methods.map((m) => ({ title: METHOD_UZ[m], width: 1.8, align: "right" as const })),
          ...(rest.length ? [{ title: "Boshqa usul", width: 1.6, align: "right" as const }] : []),
          { title: "Jami", width: 2, align: "right" },
        ],
        d.byDay.map((day) => [
          `${dayLabel(day.day, false)}, ${weekday(day.day).slice(0, 3)}`,
          String(day.count),
          ...methods.map((m) => sum(day.methods[m] ?? 0)),
          ...(rest.length ? [sum(rest.reduce((s, m) => s + (day.methods[m] ?? 0), 0))] : []),
          sum(day.total),
        ]),
        [
          "Jami",
          String(count),
          ...methods.map((m) => sum(d.byMethod.find((x) => x.method === m)?.total ?? 0)),
          ...(rest.length ? [sum(rest.reduce((s, m) => s + (d.byMethod.find((x) => x.method === m)?.total ?? 0), 0))] : []),
          sum(d.total),
        ],
      );
    }
    if (count) {
      table(
        "Xarajatlar ro'yxati",
        [
          { title: "#", width: 0.6, align: "right" },
          { title: "Sana", width: 1.4 },
          { title: "Turkum", width: 1.9 },
          { title: "Izoh", width: 3.4 },
          { title: "Usul", width: 1.2 },
          { title: "Chek", width: 0.8, align: "center" },
          { title: "Summa", width: 1.9, align: "right" },
        ],
        d.rows.map((r, i) => [String(i + 1), dayLabel(r.day, false), r.category, r.note || "—", METHOD_UZ[r.method] ?? r.method, this.receiptLabel(r), sum(r.amount)]),
        ["", "", `Jami: ${count} ta`, "", "", "", `${sum(d.total)} so'm`],
      );
    } else {
      empty("Bu davrda xarajat yozilmagan.");
    }

    return finish();
  }
}
