import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, requireMoneyScope, toTenantScope } from "../iam/tenant-auth.types";
import {
  DAY_MS,
  METHOD_ORDER,
  METHOD_UZ,
  MONEY,
  TASHKENT_OFFSET_MS,
  checkReportParams,
  dayLabel,
  dayOf,
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

export type { ReportFormat, ReportKind } from "./report-kit";

const THEME: ReportTheme = { accent: "#1f7a4d", light: "#eaf6ef" };

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

interface ReportData extends ReportHead {
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
    checkReportParams(kind, from, to, format);

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
    const periodLabel = periodLabelOf(kind, from, to, rows[0]?.day, rows[rows.length - 1]?.day);

    const data: ReportData = {
      organization: branch.organization.name,
      branch: branch.name,
      periodLabel,
      generatedAt: generatedStamp(),
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

    const buffer = format === "xlsx" ? await this.excel(data) : await this.pdf(data);
    return reportFile(buffer, "tolovlar-hisoboti", stampOf(kind, from, to), format);
  }

  // ------------------------------------------------------------------ Excel

  private async excel(d: ReportData): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = d.generatedBy;
    wb.created = new Date();
    const { head, totalRow, titleBlock, section, info, zebra } = excelKit(d, THEME);

    // 1. Umumiy
    const ws = wb.addWorksheet("Umumiy", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 30 }, { width: 16 }, { width: 14 }, { width: 22 }, { width: 12 }];
    titleBlock(ws, "To'lovlar hisoboti", 5);
    info(
      ws,
      [
        ["Davr", d.periodLabel],
        ["Hisobot tuzildi", `${d.generatedAt} (${d.generatedBy})`],
        ["Jami qabul qilindi", d.total],
        ["To'lovlar soni", d.completed.length],
        ["To'lagan bolalar", d.childrenCount],
        ["O'rtacha to'lov", d.completed.length ? Math.round(d.total / d.completed.length) : 0],
        ["Bekor qilingan to'lovlar", d.cancelled.length ? `${d.cancelled.length} ta · ${sum(d.cancelledTotal)} so'm` : "yo'q"],
      ],
      ["Jami qabul qilindi", "O'rtacha to'lov"],
      "Jami qabul qilindi",
      5,
    );
    ws.addRow([]);
    section(ws, "TO'LOV USULLARI");
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
    section(ws, "GURUHLAR BO'YICHA");
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
      const r = wd.addRow([dayLabel(day.day), weekday(day.day), day.count, ...d.dayMethods.map((m) => day.methods[m] ?? 0), day.total]);
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
      zebra(row, i);
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
    const { cards, table, empty, finish } = pdfKit(d, "To'lovlar hisoboti", THEME);

    cards([
      ["Jami qabul qilindi", `${sum(d.total)} so'm`],
      ["To'lovlar soni", `${d.completed.length} ta`],
      ["To'lagan bolalar", `${d.childrenCount} ta`],
      ["Bekor qilingan", d.cancelled.length ? `${d.cancelled.length} ta · ${sum(d.cancelledTotal)}` : "yo'q"],
    ]);
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
          `${dayLabel(day.day, false)}, ${weekday(day.day).slice(0, 3)}`,
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
    if (!d.completed.length && !d.cancelled.length) empty("Bu davrda to'lov yo'q.");

    return finish();
  }
}
