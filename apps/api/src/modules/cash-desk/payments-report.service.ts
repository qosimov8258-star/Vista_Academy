import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, requireMoneyScope, toTenantScope } from "../iam/tenant-auth.types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportKind = "day" | "week" | "month" | "all";
export type ReportFormat = "xlsx" | "pdf";

const METHOD_ORDER = ["CASH", "CARD", "BANK_TRANSFER", "CLICK", "PAYME", "UZUM", "MOBILE_APP", "BANKOMAT", "OTHER"] as const;
const METHOD_UZ: Record<string, string> = {
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
const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

interface Row {
  id: string;
  day: string;
  time: string;
  childName: string;
  publicId: number | null;
  groupName: string;
  periods: string;
  method: string;
  amount: number;
  status: string;
  recordedBy: string;
  note: string;
  refundReason: string;
  refundedBy: string;
  refundedDay: string;
}

interface ReportData {
  organization: string;
  branch: string;
  periodLabel: string;
  generatedAt: string;
  generatedBy: string;
  rows: Row[];
  completed: Row[];
  cancelled: Row[];
  total: number;
  childrenCount: number;
  cancelledTotal: number;
  byMethod: { method: string; count: number; total: number }[];
  byGroup: { group: string; count: number; children: number; total: number }[];
  byDay: { day: string; count: number; total: number; methods: Record<string, number> }[];
  dayMethods: string[];
}

const tashkent = (d: Date) => new Date(d.getTime() + TASHKENT_OFFSET_MS);
const dayOf = (d: Date) => tashkent(d).toISOString().slice(0, 10);
const timeOf = (d: Date) => tashkent(d).toISOString().slice(11, 16);
const sum = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** Standart PDF shrifti faqat lotin harflarini biladi — o'zbekcha tutuq belgilari oddiy apostrofga */
const plain = (s: string) => s.replace(/[ʻʼ‘’`´]/g, "'").replace(/[“”]/g, '"');

function dayLabel(day: string, withYear = true) {
  const [y, m, d] = day.split("-").map(Number);
  return `${d}-${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}
function periodName(period: string) {
  const [y, m] = period.split("-").map(Number);
  const name = MONTHS[m - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/**
 * To'lovlar hisoboti (Excel va PDF): tanlangan davrda qabul qilingan
 * to'lovlar — jami, usullar, guruhlar va kunlar bo'yicha, batafsil ro'yxat
 * va bekor qilinganlar (sababi bilan). Kunlar Toshkent vaqti bo'yicha.
 */
@Injectable()
export class PaymentsReportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(caller: TenantAuthenticatedUser, kind: ReportKind, from: string | undefined, to: string | undefined, format: ReportFormat) {
    const scope = toTenantScope(caller);
    const branchId = requireMoneyScope(scope);
    if (!["day", "week", "month", "all"].includes(kind)) throw new BadRequestException("Hisobot turi noto'g'ri");
    if (!["xlsx", "pdf"].includes(format)) throw new BadRequestException("Fayl turi noto'g'ri");
    if (kind !== "all" && (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to)) {
      throw new BadRequestException("Davr noto'g'ri (YYYY-MM-DD)");
    }

    const range =
      kind === "all"
        ? undefined
        : { gte: new Date(new Date(`${from}T00:00:00.000Z`).getTime() - TASHKENT_OFFSET_MS), lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() - TASHKENT_OFFSET_MS + DAY_MS) };

    const [branch, payments] = await Promise.all([
      this.prisma.branch.findUniqueOrThrow({ where: { id: branchId }, select: { name: true, organization: { select: { name: true } } } }),
      this.prisma.payment.findMany({
        where: { branchId, ...(range ? { createdAt: range } : {}) },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          note: true,
          createdAt: true,
          refundReason: true,
          refundedByName: true,
          refundedAt: true,
          recordedBy: { select: { fullName: true } },
          child: { select: { fullName: true, publicId: true, group: { select: { name: true } } } },
          allocations: { select: { invoice: { select: { period: true } } } },
        },
      }),
    ]);

    const rows: Row[] = payments.map((p) => ({
      id: p.id,
      day: dayOf(p.createdAt),
      time: timeOf(p.createdAt),
      childName: p.child.fullName,
      publicId: p.child.publicId,
      groupName: p.child.group?.name ?? "Guruhsiz",
      periods: [...new Set(p.allocations.map((a) => a.invoice.period))].sort().map(periodName).join(", "),
      method: p.method,
      amount: Number(p.amount),
      status: p.status,
      recordedBy: p.recordedBy?.fullName ?? "",
      note: p.note ?? "",
      refundReason: p.refundReason ?? "",
      refundedBy: p.refundedByName ?? "",
      refundedDay: p.refundedAt ? dayOf(p.refundedAt) : "",
    }));
    const completed = rows.filter((r) => r.status === "COMPLETED");
    const cancelled = rows.filter((r) => r.status !== "COMPLETED");

    const byMethod = METHOD_ORDER.map((m) => {
      const xs = completed.filter((r) => r.method === m);
      return { method: m, count: xs.length, total: xs.reduce((s, r) => s + r.amount, 0) };
    }).filter((x) => x.count > 0);

    const groups = new Map<string, { count: number; children: Set<string>; total: number }>();
    for (const r of completed) {
      const g = groups.get(r.groupName) ?? { count: 0, children: new Set<string>(), total: 0 };
      g.count += 1;
      g.children.add(`${r.childName}#${r.publicId}`);
      g.total += r.amount;
      groups.set(r.groupName, g);
    }
    const byGroup = [...groups.entries()]
      .map(([group, g]) => ({ group, count: g.count, children: g.children.size, total: g.total }))
      .sort((a, b) => b.total - a.total);

    const days = new Map<string, { count: number; total: number; methods: Record<string, number> }>();
    for (const r of completed) {
      const d = days.get(r.day) ?? { count: 0, total: 0, methods: {} };
      d.count += 1;
      d.total += r.amount;
      d.methods[r.method] = (d.methods[r.method] ?? 0) + r.amount;
      days.set(r.day, d);
    }
    const byDay = [...days.entries()].map(([day, d]) => ({ day, ...d })).sort((a, b) => a.day.localeCompare(b.day));

    const firstDay = rows[0]?.day;
    const lastDay = rows[rows.length - 1]?.day;
    const periodLabel =
      kind === "day"
        ? `${dayLabel(from!)} (${WEEKDAYS[new Date(`${from}T00:00:00Z`).getUTCDay()].toLowerCase()})`
        : kind === "week"
          ? `${dayLabel(from!, false)} — ${dayLabel(to!)} (hafta)`
          : kind === "month"
            ? periodName(from!.slice(0, 7))
            : firstDay
              ? `To'liq: ${dayLabel(firstDay)} — ${dayLabel(lastDay!)}`
              : "To'liq";

    const now = new Date();
    const data: ReportData = {
      organization: branch.organization.name,
      branch: branch.name,
      periodLabel,
      generatedAt: `${dayLabel(dayOf(now))}, ${timeOf(now)}`,
      generatedBy: caller.fullName,
      rows,
      completed,
      cancelled,
      total: completed.reduce((s, r) => s + r.amount, 0),
      childrenCount: new Set(completed.map((r) => `${r.childName}#${r.publicId}`)).size,
      cancelledTotal: cancelled.reduce((s, r) => s + r.amount, 0),
      byMethod,
      byGroup,
      byDay,
      dayMethods: METHOD_ORDER.filter((m) => byMethod.some((x) => x.method === m)),
    };

    const stamp = kind === "all" ? "toliq" : kind === "month" ? from!.slice(0, 7) : from === to ? from : `${from}_${to}`;
    const filename = `tolovlar-hisoboti-${stamp}.${format}`;
    const buffer = format === "xlsx" ? await this.excel(data) : await this.pdf(data);
    return { buffer, filename, contentType: format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf" };
  }

  // ------------------------------------------------------------------ Excel

  private async excel(d: ReportData): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = d.generatedBy;
    wb.created = new Date();
    const GREEN = "FF1F7A4D";
    const LIGHT = "FFEAF6EF";
    const MONEY = '#,##0" so\'m"';
    const head = (row: ExcelJS.Row) => {
      row.eachCell((c) => {
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
        c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        c.border = { bottom: { style: "thin", color: { argb: "FFB7D7C4" } } };
      });
      row.height = 22;
    };
    const totalRow = (row: ExcelJS.Row) => {
      row.eachCell((c) => {
        c.font = { bold: true };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
        c.border = { top: { style: "thin", color: { argb: "FF1F7A4D" } } };
      });
    };
    const titleBlock = (ws: ExcelJS.Worksheet, title: string, cols: number) => {
      ws.mergeCells(1, 1, 1, cols);
      const t = ws.getCell(1, 1);
      t.value = `${d.organization} — ${title}`;
      t.font = { bold: true, size: 15, color: { argb: GREEN } };
      ws.mergeCells(2, 1, 2, cols);
      ws.getCell(2, 1).value = `${d.branch} · ${d.periodLabel}`;
      ws.getCell(2, 1).font = { size: 11, color: { argb: "FF555555" } };
      ws.addRow([]);
    };

    // 1. Umumiy
    const ws = wb.addWorksheet("Umumiy", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 30 }, { width: 16 }, { width: 14 }, { width: 22 }, { width: 12 }];
    titleBlock(ws, "To'lovlar hisoboti", 5);
    const info: [string, string | number][] = [
      ["Davr", d.periodLabel],
      ["Hisobot tuzildi", `${d.generatedAt} (${d.generatedBy})`],
      ["Jami qabul qilindi", d.total],
      ["To'lovlar soni", d.completed.length],
      ["To'lagan bolalar", d.childrenCount],
      ["O'rtacha to'lov", d.completed.length ? Math.round(d.total / d.completed.length) : 0],
      ["Bekor qilingan to'lovlar", d.cancelled.length ? `${d.cancelled.length} ta · ${sum(d.cancelledTotal)} so'm` : "yo'q"],
    ];
    for (const [k, v] of info) {
      const r = ws.addRow([k, v]);
      r.getCell(1).font = { color: { argb: "FF6D6D72" } };
      r.getCell(2).font = { bold: true, size: k === "Jami qabul qilindi" ? 14 : 11 };
      r.getCell(2).alignment = { horizontal: "left" };
      if (k === "Jami qabul qilindi" || k === "O'rtacha to'lov") r.getCell(2).numFmt = MONEY;
      ws.mergeCells(r.number, 2, r.number, 5);
    }
    ws.addRow([]);
    ws.addRow(["TO'LOV USULLARI"]).font = { bold: true, color: { argb: GREEN } };
    head(ws.addRow(["Usul", "Soni", "Ulushi", "Summa"]));
    for (const m of d.byMethod) {
      const r = ws.addRow([METHOD_UZ[m.method], m.count, d.total ? m.total / d.total : 0, m.total]);
      r.getCell(3).numFmt = "0.0%";
      r.getCell(4).numFmt = MONEY;
    }
    const mt = ws.addRow(["Jami", d.completed.length, d.total ? 1 : 0, d.total]);
    mt.getCell(3).numFmt = "0.0%";
    mt.getCell(4).numFmt = MONEY;
    totalRow(mt);
    ws.addRow([]);
    ws.addRow(["GURUHLAR BO'YICHA"]).font = { bold: true, color: { argb: GREEN } };
    head(ws.addRow(["Guruh", "To'lovlar soni", "Bolalar soni", "Summa", "Ulushi"]));
    for (const g of d.byGroup) {
      const r = ws.addRow([g.group, g.count, g.children, g.total, d.total ? g.total / d.total : 0]);
      r.getCell(4).numFmt = MONEY;
      r.getCell(5).numFmt = "0.0%";
    }
    const gt = ws.addRow(["Jami", d.completed.length, d.childrenCount, d.total, d.total ? 1 : 0]);
    gt.getCell(4).numFmt = MONEY;
    gt.getCell(5).numFmt = "0.0%";
    totalRow(gt);

    // 2. Kunlar
    const wd = wb.addWorksheet("Kunlar bo'yicha", { views: [{ state: "frozen", ySplit: 4, showGridLines: false }] });
    const dcols = ["Sana", "Hafta kuni", "Soni", ...d.dayMethods.map((m) => METHOD_UZ[m]), "Jami"];
    wd.columns = dcols.map((_, i) => ({ width: i === 0 ? 16 : i === 1 ? 13 : i === 2 ? 8 : 16 }));
    titleBlock(wd, "Kunlar bo'yicha", dcols.length);
    head(wd.addRow(dcols));
    for (const day of d.byDay) {
      const r = wd.addRow([dayLabel(day.day), WEEKDAYS[new Date(`${day.day}T00:00:00Z`).getUTCDay()], day.count, ...d.dayMethods.map((m) => day.methods[m] ?? 0), day.total]);
      for (let i = 4; i <= dcols.length; i++) r.getCell(i).numFmt = MONEY;
    }
    const dt = wd.addRow(["Jami", "", d.completed.length, ...d.dayMethods.map((m) => d.byMethod.find((x) => x.method === m)?.total ?? 0), d.total]);
    for (let i = 4; i <= dcols.length; i++) dt.getCell(i).numFmt = MONEY;
    totalRow(dt);

    // 3. To'lovlar (batafsil)
    const wp = wb.addWorksheet("To'lovlar", { views: [{ state: "frozen", ySplit: 4 }] });
    const pcols = ["№", "Sana", "Vaqt", "Bola", "ID", "Guruh", "Oy(lar)", "Usul", "Summa", "Qabul qildi", "Izoh"];
    wp.columns = [5, 16, 7, 28, 9, 18, 18, 11, 16, 18, 30].map((width) => ({ width }));
    titleBlock(wp, "To'lovlar ro'yxati", pcols.length);
    head(wp.addRow(pcols));
    d.completed.forEach((r, i) => {
      const row = wp.addRow([i + 1, dayLabel(r.day), r.time, r.childName, r.publicId ? `id${r.publicId}` : "", r.groupName, r.periods, METHOD_UZ[r.method] ?? r.method, r.amount, r.recordedBy, r.note]);
      row.getCell(9).numFmt = MONEY;
      if (i % 2 === 1) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F7F9" } }));
    });
    const pt = wp.addRow(["", "", "", "Jami", "", "", "", `${d.completed.length} ta`, d.total]);
    pt.getCell(9).numFmt = MONEY;
    totalRow(pt);
    wp.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: pcols.length } };

    // 4. Bekor qilingan
    if (d.cancelled.length) {
      const wc = wb.addWorksheet("Bekor qilingan", { views: [{ state: "frozen", ySplit: 4 }] });
      const ccols = ["Sana", "Bola", "Guruh", "Usul", "Summa", "Bekor qilindi", "Kim", "Sabab"];
      wc.columns = [16, 28, 18, 11, 16, 16, 18, 40].map((width) => ({ width }));
      titleBlock(wc, "Bekor qilingan to'lovlar", ccols.length);
      head(wc.addRow(ccols));
      for (const r of d.cancelled) {
        const row = wc.addRow([dayLabel(r.day), r.childName, r.groupName, METHOD_UZ[r.method] ?? r.method, r.amount, r.refundedDay ? dayLabel(r.refundedDay) : "", r.refundedBy, r.refundReason]);
        row.getCell(5).numFmt = MONEY;
      }
      const ct = wc.addRow(["Jami", `${d.cancelled.length} ta`, "", "", d.cancelledTotal]);
      ct.getCell(5).numFmt = MONEY;
      totalRow(ct);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  // ------------------------------------------------------------------ PDF

  private pdf(d: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true, info: { Title: plain(`To'lovlar hisoboti — ${d.periodLabel}`) } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const GREEN = "#1f7a4d";
      const GRAY = "#6d6d72";
      const left = doc.page.margins.left;
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottom = () => doc.page.height - doc.page.margins.bottom - 14;

      // Sarlavha
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#111").text(plain(d.organization), left, 40);
      doc.font("Helvetica").fontSize(10).fillColor(GRAY).text(plain(d.branch));
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(15).fillColor(GREEN).text("To'lovlar hisoboti");
      doc.font("Helvetica").fontSize(10.5).fillColor("#111").text(plain(d.periodLabel));
      doc.fontSize(8.5).fillColor(GRAY).text(plain(`Tuzildi: ${d.generatedAt} · ${d.generatedBy}`));
      doc.moveDown(0.8);

      // Ko'rsatkich kartalari
      const cards: [string, string][] = [
        ["Jami qabul qilindi", `${sum(d.total)} so'm`],
        ["To'lovlar soni", `${d.completed.length} ta`],
        ["To'lagan bolalar", `${d.childrenCount} ta`],
        ["Bekor qilingan", d.cancelled.length ? `${d.cancelled.length} ta · ${sum(d.cancelledTotal)}` : "yo'q"],
      ];
      const gap = 8;
      const cw = (width - gap * 3) / 4;
      const cy = doc.y;
      cards.forEach(([label, value], i) => {
        const x = left + i * (cw + gap);
        doc.roundedRect(x, cy, cw, 52, 8).fill(i === 0 ? "#eaf6ef" : "#f2f2f7");
        doc.font("Helvetica").fontSize(8.5).fillColor(GRAY).text(label, x + 10, cy + 9, { width: cw - 20 });
        doc.font("Helvetica-Bold").fontSize(i === 0 ? 13 : 12).fillColor(i === 0 ? GREEN : "#111").text(plain(value), x + 10, cy + 26, { width: cw - 20 });
      });
      doc.y = cy + 66;

      type Col = { title: string; width: number; align?: "left" | "right" | "center" };
      const table = (title: string, cols: Col[], rows: string[][], total?: string[]) => {
        const scale = width / cols.reduce((s, c) => s + c.width, 0);
        const ws = cols.map((c) => c.width * scale);
        const rowH = 18;
        const drawHead = () => {
          const y = doc.y;
          doc.rect(left, y, width, rowH).fill(GREEN);
          let x = left;
          cols.forEach((c, i) => {
            doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#fff").text(c.title, x + 5, y + 5, { width: ws[i] - 10, align: c.align ?? "left", lineBreak: false, ellipsis: true });
            x += ws[i];
          });
          doc.y = y + rowH;
        };
        if (doc.y + 60 > bottom()) doc.addPage();
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#111").text(title, left, doc.y);
        doc.moveDown(0.3);
        drawHead();
        // `keep` — shu qator bilan birga sig'ishi kerak bo'lgan qatorlar soni (oxirgi qator + Jami ajralmasin)
        const drawRow = (cells: string[], i: number, bold = false, keep = 1) => {
          if (doc.y + rowH * keep > bottom()) {
            doc.addPage();
            drawHead();
          }
          const y = doc.y;
          if (bold) doc.rect(left, y, width, rowH).fill("#eaf6ef");
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
      const pct = (v: number) => (d.total ? `${((v / d.total) * 100).toFixed(1)}%` : "0%");

      table(
        "To'lov usullari",
        [{ title: "Usul", width: 3 }, { title: "Soni", width: 1.2, align: "right" }, { title: "Ulushi", width: 1.4, align: "right" }, { title: "Summa", width: 2.4, align: "right" }],
        d.byMethod.map((m) => [METHOD_UZ[m.method], String(m.count), pct(m.total), `${sum(m.total)} so'm`]),
        ["Jami", String(d.completed.length), d.total ? "100%" : "0%", `${sum(d.total)} so'm`],
      );
      table(
        "Guruhlar bo'yicha",
        [{ title: "Guruh", width: 3 }, { title: "To'lovlar", width: 1.3, align: "right" }, { title: "Bolalar", width: 1.3, align: "right" }, { title: "Ulushi", width: 1.2, align: "right" }, { title: "Summa", width: 2.3, align: "right" }],
        d.byGroup.map((g) => [g.group, String(g.count), String(g.children), pct(g.total), `${sum(g.total)} so'm`]),
        ["Jami", String(d.completed.length), String(d.childrenCount), d.total ? "100%" : "0%", `${sum(d.total)} so'm`],
      );
      if (d.byDay.length > 1) {
        const methods = d.dayMethods.slice(0, 4);
        const rest = d.dayMethods.slice(4);
        table(
          "Kunlar bo'yicha",
          [
            { title: "Sana", width: 2.4 },
            { title: "Soni", width: 0.9, align: "right" },
            ...methods.map((m) => ({ title: METHOD_UZ[m], width: 1.8, align: "right" as const })),
            ...(rest.length ? [{ title: "Boshqa", width: 1.6, align: "right" as const }] : []),
            { title: "Jami", width: 2, align: "right" },
          ],
          d.byDay.map((day) => [
            `${dayLabel(day.day, false)}, ${WEEKDAYS[new Date(`${day.day}T00:00:00Z`).getUTCDay()].slice(0, 3)}`,
            String(day.count),
            ...methods.map((m) => sum(day.methods[m] ?? 0)),
            ...(rest.length ? [sum(rest.reduce((s, m) => s + (day.methods[m] ?? 0), 0))] : []),
            sum(day.total),
          ]),
          [
            "Jami",
            String(d.completed.length),
            ...methods.map((m) => sum(d.byMethod.find((x) => x.method === m)?.total ?? 0)),
            ...(rest.length ? [sum(rest.reduce((s, m) => s + (d.byMethod.find((x) => x.method === m)?.total ?? 0), 0))] : []),
            sum(d.total),
          ],
        );
      }
      table(
        "To'lovlar ro'yxati",
        [
          { title: "#", width: 0.6, align: "right" },
          { title: "Sana", width: 1.7 },
          { title: "Bola", width: 3.4 },
          { title: "Guruh", width: 2 },
          { title: "Usul", width: 1.3 },
          { title: "Summa", width: 2, align: "right" },
        ],
        d.completed.map((r, i) => [String(i + 1), `${dayLabel(r.day, false)} ${r.time}`, r.childName, r.groupName, METHOD_UZ[r.method] ?? r.method, sum(r.amount)]),
        ["", "", `Jami: ${d.completed.length} ta`, "", "", `${sum(d.total)} so'm`],
      );
      if (d.cancelled.length) {
        table(
          "Bekor qilingan to'lovlar",
          [
            { title: "Sana", width: 1.5 },
            { title: "Bola", width: 2.8 },
            { title: "Summa", width: 1.7, align: "right" },
            { title: "Kim", width: 1.7 },
            { title: "Sabab", width: 3.3 },
          ],
          d.cancelled.map((r) => [dayLabel(r.day, false), r.childName, sum(r.amount), r.refundedBy, r.refundReason || "—"]),
          ["Jami", `${d.cancelled.length} ta`, sum(d.cancelledTotal), "", ""],
        );
      }
      if (!d.completed.length && !d.cancelled.length) {
        doc.font("Helvetica").fontSize(11).fillColor(GRAY).text("Bu davrda to'lov yo'q.", left, doc.y);
      }

      // Sahifa raqamlari
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // Pastki chegara ostiga yozilganda pdfkit yangi sahifa ochmasin
        doc.page.margins.bottom = 0;
        doc.font("Helvetica").fontSize(8).fillColor(GRAY).text(plain(`${d.organization} · To'lovlar hisoboti · ${d.periodLabel}`), left, doc.page.height - 30, { width: width - 80, lineBreak: false });
        doc.text(`${i - range.start + 1} / ${range.count}`, left + width - 80, doc.page.height - 30, { width: 80, align: "right", lineBreak: false });
      }
      doc.end();
    });
  }
}
