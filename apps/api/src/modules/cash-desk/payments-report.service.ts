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

import { addGroupSheets, stateOf, type GroupChildRow, type GroupsWorkbookInput } from "./payments-groups-excel";

export type { ReportFormat, ReportKind } from "./report-kit";

/** To'lov usuli → guruh varag'idagi ustun (bog'chaning jadvalidagi kabi) */
const METHOD_COLUMN: Record<string, string> = {
  CASH: "Naqd",
  CLICK: "Click",
  CARD: "Terminal (karta)",
  BANKOMAT: "Terminal (karta)",
  BANK_TRANSFER: "O'tkazma",
};
const BASE_COLUMNS = ["Naqd", "Click", "Terminal (karta)", "O'tkazma"];
const columnOf = (method: string) => METHOD_COLUMN[method] ?? "Boshqa";
const ddmmyyyy = (d: Date) => dayOf(d).split("-").reverse().join(".");

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
  groups: GroupsWorkbookInput;
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
      groups: format === "xlsx" ? await this.groupsData(branchId, kind, from, to, range, branch.organization.name, periodLabel) : (undefined as never),
    };

    const buffer = format === "xlsx" ? await this.excel(data) : await this.pdf(data);
    return reportFile(buffer, "tolovlar-hisoboti", stampOf(kind, from, to), format);
  }

  /**
   * Guruh varaqlari uchun: har bola — shu davr uchun to'lanishi kerak
   * (hisob-faktura, chegirma ayirilgan), usullar bo'yicha to'langani,
   * to'lov sanalari. Oylik/to'liq hisobotda to'lov shu oy(lar)ning
   * hisob-fakturasiga taqsimlangan summa; kun/hafta hisobotida — shu
   * kunlarda qabul qilingan to'lovlar, qarz va holat esa oy bo'yicha.
   */
  private async groupsData(
    branchId: string,
    kind: ReportKind,
    from: string | undefined,
    to: string | undefined,
    range: { gte: Date; lt: Date } | undefined,
    organization: string,
    periodLabel: string,
  ): Promise<GroupsWorkbookInput> {
    const byRange = kind === "day" || kind === "week";
    const periods = kind === "all" ? undefined : [...new Set([from!.slice(0, 7), to!.slice(0, 7)])];
    const invoiceWhere = { status: { not: "CANCELLED" as const }, ...(periods ? { period: { in: periods } } : {}) };
    const children = await this.prisma.child.findMany({
      where: {
        branchId,
        OR: [
          { status: "ACTIVE" },
          { invoices: { some: invoiceWhere } },
          ...(range ? [{ payments: { some: { status: "COMPLETED" as const, createdAt: range } } }] : []),
        ],
      },
      orderBy: { fullName: "asc" },
      select: {
        fullName: true,
        group: { select: { name: true } },
        invoices: {
          where: invoiceWhere,
          select: {
            amount: true,
            discountAmount: true,
            allocations: { select: { amount: true, payment: { select: { status: true, method: true, createdAt: true } } } },
          },
        },
        payments: {
          where: { status: "COMPLETED", ...(range ? { createdAt: range } : {}) },
          select: { amount: true, method: true, createdAt: true },
        },
      },
    });

    let other = false;
    const groups = new Map<string, GroupChildRow[]>();
    for (const c of children) {
      const fee = c.invoices.length ? c.invoices.reduce((s, i) => s + Number(i.amount) - Number(i.discountAmount), 0) : null;
      const allocations = c.invoices.flatMap((i) => i.allocations).filter((a) => a.payment.status === "COMPLETED");
      const paidToward = allocations.reduce((s, a) => s + Number(a.amount), 0);
      const paid: Record<string, number> = {};
      const dates = new Set<string>();
      const add = (method: string, amount: number, at: Date) => {
        const column = columnOf(method);
        if (column === "Boshqa") other = true;
        paid[column] = (paid[column] ?? 0) + amount;
        dates.add(dayOf(at));
      };
      if (byRange) for (const p of c.payments) add(p.method, Number(p.amount), p.createdAt);
      else for (const a of allocations) add(a.payment.method, Number(a.amount), a.payment.createdAt);
      const row: GroupChildRow = {
        name: c.fullName,
        fee,
        paid,
        dates: [...dates].sort().map((d) => d.split("-").reverse().join(".")),
        ...(byRange ? { debt: fee === null ? null : Math.max(fee - paidToward, 0), state: stateOf(fee, paidToward) } : {}),
      };
      const g = c.group?.name ?? "Guruhsiz";
      groups.set(g, [...(groups.get(g) ?? []), row]);
    }

    return {
      periodLabel: kind === "month" ? periodName(from!.slice(0, 7)) : periodLabel,
      byFormula: !byRange,
      note: byRange ? "Ustunlarda — shu kunlarda qabul qilingan to'lovlar; oylik to'lov, qarz va holat — oy bo'yicha (hozirgi holat)." : undefined,
      methodColumns: other ? [...BASE_COLUMNS, "Boshqa"] : BASE_COLUMNS,
      groups: [...groups.entries()]
        .sort(([a], [b]) => (a === "Guruhsiz" ? 1 : b === "Guruhsiz" ? -1 : a.localeCompare(b)))
        .map(([name, rows]) => ({ name, children: rows })),
      source: `Manba: ${organization} tizimi (To'lovlar bo'limi), ${ddmmyyyy(new Date())} holatiga.`,
    };
  }

  // ------------------------------------------------------------------ Excel

  private async excel(d: ReportData): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = d.generatedBy;
    wb.created = new Date();
    const { head, totalRow, titleBlock, zebra } = excelKit(d, THEME);

    // 1. Umumiy + har guruh alohida varaqda (bog'chaning jadvalidagi ko'rinish)
    addGroupSheets(wb, d.groups, ["To'lovlar", "Bekor qilingan"]);

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
