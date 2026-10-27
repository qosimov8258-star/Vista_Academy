import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { resolveTeacherGroupIds } from "../iam/teacher-scope";
import {
  DATE_RE,
  DAY_MS,
  dayLabel,
  excelKit,
  generatedStamp,
  periodLabelOf,
  reportFile,
  stampOf,
  weekday,
  type ReportHead,
  type ReportKind,
  type ReportTheme,
} from "../cash-desk/report-kit";

const THEME: ReportTheme = { accent: "#248a3d", light: "#e3f4e8" };
/** Kunlik jadval (tabel) shu kundan uzun davrda chiqarilmaydi — juda keng bo'lib ketadi */
const MAX_TABEL_DAYS = 62;

const STATUS_UZ: Record<string, string> = { PRESENT: "Keldi", LATE: "Kech qoldi", ABSENT: "Kelmadi", SICK: "Kasal" };
/** Tabel katagidagi qisqa belgi */
const STATUS_SHORT: Record<string, string> = { PRESENT: "✓", LATE: "Kech", ABSENT: "✕", SICK: "Kasal" };
const STATUS_FILL: Record<string, string> = {
  PRESENT: "FFE2F0D9",
  LATE: "FFFFF2CC",
  ABSENT: "FFFCE4E4",
  SICK: "FFEFE3F7",
};
const PERCENT = "0%";

const came = (status: string) => status === "PRESENT" || status === "LATE";
/** Davomat foizi — belgilangan kunlardan kelganlari (belgilanmagan kun hisobga kirmaydi) */
const rate = (present: number, marked: number) => (marked ? present / marked : null);

interface Row {
  day: string;
  childId: string;
  name: string;
  group: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  note: string;
  parentReason: string;
}

interface Totals {
  present: number;
  late: number;
  absent: number;
  sick: number;
  faceId: number;
}

const tally = (rows: Row[]): Totals => ({
  present: rows.filter((r) => came(r.status)).length,
  late: rows.filter((r) => r.status === "LATE").length,
  absent: rows.filter((r) => r.status === "ABSENT").length,
  sick: rows.filter((r) => r.status === "SICK").length,
  faceId: rows.filter((r) => r.checkIn).length,
});
const markedOf = (t: Totals) => t.present + t.absent + t.sick;

/**
 * Bolalar davomati hisoboti (Excel): tanlangan davrdagi davomat — umumiy
 * jamlanma, guruhlar, bola × kun tabeli, kunlar bo'yicha va batafsil ro'yxat.
 * Tarbiyachi faqat o'z guruhlarini oladi. Ko'rinishi to'lovlar hisoboti
 * bilan bir xil (report-kit).
 */
@Injectable()
export class AttendanceReportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(caller: TenantAuthenticatedUser, kind: ReportKind, from: string | undefined, to: string | undefined, queryBranchId: string | undefined) {
    const scope = toTenantScope(caller);
    if (scope.role === "CHEF") throw new ForbiddenException("Davomat hisobotini yuklab olish huquqingiz yo'q");
    if (!["day", "week", "month", "all"].includes(kind)) throw new BadRequestException("Hisobot turi noto'g'ri");
    if (kind !== "all" && (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to)) {
      throw new BadRequestException("Davr noto'g'ri (YYYY-MM-DD)");
    }
    const branchId = scope.branchId ?? queryBranchId;
    if (!branchId) throw new BadRequestException("Filialni tanlang");
    if (scope.branchId && queryBranchId && queryBranchId !== scope.branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId: scope.organizationId },
      select: { name: true, organization: { select: { name: true } } },
    });
    if (!branch) throw new NotFoundException("Filial topilmadi");

    // Tarbiyachi — faqat o'ziga biriktirilgan guruhlar (null — butun filial)
    const teacherGroupIds = await resolveTeacherGroupIds(this.prisma, scope);
    const groupFilter = teacherGroupIds === null ? {} : { groupId: { in: teacherGroupIds } };

    const dateRange = kind === "all" ? undefined : { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) };
    const records = await this.prisma.attendance.findMany({
      where: { branchId, ...(dateRange ? { date: dateRange } : {}), child: groupFilter },
      orderBy: [{ date: "asc" }, { child: { fullName: "asc" } }],
      select: {
        date: true,
        status: true,
        checkInTime: true,
        checkOutTime: true,
        note: true,
        parentReason: true,
        child: { select: { id: true, fullName: true, group: { select: { name: true } } } },
      },
    });
    const firstDay = kind === "all" ? records[0]?.date.toISOString().slice(0, 10) : from!;
    const lastDay = kind === "all" ? records[records.length - 1]?.date.toISOString().slice(0, 10) : to!;

    // Faol bolalar (davomati yo'qlari ham ro'yxatda) + davrda yozuvi bor sobiq bolalar
    const children = await this.prisma.child.findMany({
      where: { branchId, ...groupFilter, OR: [{ status: "ACTIVE" }, { id: { in: [...new Set(records.map((r) => r.child.id))] } }] },
      orderBy: [{ group: { name: "asc" } }, { fullName: "asc" }],
      select: { id: true, fullName: true, group: { select: { name: true } } },
    });

    const rows: Row[] = records.map((r) => ({
      day: r.date.toISOString().slice(0, 10),
      childId: r.child.id,
      name: r.child.fullName,
      group: r.child.group?.name ?? "—",
      status: r.status,
      checkIn: r.checkInTime,
      checkOut: r.checkOutTime,
      note: r.note ?? "",
      parentReason: r.parentReason ?? "",
    }));

    const head: ReportHead = {
      organization: branch.organization.name,
      branch: branch.name,
      periodLabel: periodLabelOf(kind, from, to, firstDay, lastDay),
      generatedAt: generatedStamp(),
      generatedBy: caller.fullName,
    };
    const days = firstDay ? daysBetween(firstDay, lastDay!) : [];
    const buffer = await this.excel(head, rows, children, days);
    return reportFile(buffer, "bolalar-davomati", stampOf(kind, from, to), "xlsx");
  }

  private async excel(
    d: ReportHead,
    rows: Row[],
    children: { id: string; fullName: string; group: { name: string } | null }[],
    days: string[],
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = d.generatedBy;
    wb.created = new Date();
    const { head, totalRow, titleBlock, section, zebra } = excelKit(d, THEME);
    /** "nom — qiymat" qatorlari: 1-ustun tor (№), shuning uchun nom A:B, qiymat C dan oxirigacha */
    const info = (sheet: ExcelJS.Worksheet, items: [string, string][], big: string, mergeTo: number) => {
      for (const [k, v] of items) {
        const r = sheet.addRow([k, "", v]);
        sheet.mergeCells(r.number, 1, r.number, 2);
        sheet.mergeCells(r.number, 3, r.number, mergeTo);
        r.getCell(1).font = { color: { argb: "FF6D6D72" } };
        r.getCell(3).font = { bold: true, size: k === big ? 14 : 11 };
        r.getCell(3).alignment = { horizontal: "left" };
      }
    };
    const all = tally(rows);
    const allRate = rate(all.present, markedOf(all));
    const groups = [...new Set(children.map((c) => c.group?.name ?? "—"))];

    // 1. Umumiy — ko'rsatkichlar va har bola bo'yicha jamlanma
    const ws = wb.addWorksheet("Umumiy");
    const cols = ["№", "F.I.Sh.", "Guruh", "Keldi (kun)", "shundan kech", "Kelmadi", "Kasal", "Davomat", "Face ID bilan"];
    ws.columns = [5, 30, 18, 11, 11, 10, 9, 10, 12].map((width) => ({ width }));
    titleBlock(ws, "Bolalar davomati", cols.length);
    info(
      ws,
      [
        ["Davr", d.periodLabel],
        ["Bolalar", `${children.length} ta · ${groups.length} ta guruh`],
        ["O'rtacha davomat", allRate === null ? "—" : `${Math.round(allRate * 100)}%`],
        ["Kelgan kunlar (jami)", `${all.present} ta`],
        ["Kech qolgan", `${all.late} marta`],
        ["Kelmagan / kasal", `${all.absent} / ${all.sick}`],
        ["Tuzildi", `${d.generatedAt} · ${d.generatedBy}`],
      ],
      "O'rtacha davomat",
      cols.length,
    );
    ws.addRow([]);
    section(ws, "Bolalar bo'yicha");
    const headerRow = ws.addRow(cols);
    head(headerRow);
    children.forEach((c, i) => {
      const t = tally(rows.filter((r) => r.childId === c.id));
      const row = ws.addRow([i + 1, c.fullName, c.group?.name ?? "—", t.present, t.late || null, t.absent || null, t.sick || null, rate(t.present, markedOf(t)), t.faceId || null]);
      row.getCell(8).numFmt = PERCENT;
      [4, 5, 6, 7, 8, 9].forEach((col) => (row.getCell(col).alignment = { horizontal: "center" }));
      zebra(row, i);
    });
    const tr = ws.addRow(["", "Jami", `${children.length} ta bola`, all.present, all.late, all.absent, all.sick, allRate, all.faceId]);
    tr.getCell(8).numFmt = PERCENT;
    [4, 5, 6, 7, 8, 9].forEach((col) => (tr.getCell(col).alignment = { horizontal: "center" }));
    totalRow(tr);
    ws.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: headerRow.number, column: cols.length } };

    // 2. Guruhlar — har guruh bo'yicha jamlanma
    if (groups.length > 1) {
      const wg = wb.addWorksheet("Guruhlar");
      const gcols = ["№", "Guruh", "Bolalar", "Keldi (kun)", "shundan kech", "Kelmadi", "Kasal", "Davomat"];
      wg.columns = [5, 24, 10, 11, 11, 10, 9, 10].map((width) => ({ width }));
      titleBlock(wg, "Guruhlar bo'yicha", gcols.length);
      head(wg.addRow(gcols));
      groups.forEach((g, i) => {
        const t = tally(rows.filter((r) => r.group === g));
        const row = wg.addRow([i + 1, g, children.filter((c) => (c.group?.name ?? "—") === g).length, t.present, t.late || null, t.absent || null, t.sick || null, rate(t.present, markedOf(t))]);
        row.getCell(8).numFmt = PERCENT;
        [3, 4, 5, 6, 7, 8].forEach((col) => (row.getCell(col).alignment = { horizontal: "center" }));
        zebra(row, i);
      });
      const gt = wg.addRow(["", "Jami", children.length, all.present, all.late, all.absent, all.sick, allRate]);
      gt.getCell(8).numFmt = PERCENT;
      [3, 4, 5, 6, 7, 8].forEach((col) => (gt.getCell(col).alignment = { horizontal: "center" }));
      totalRow(gt);
    }

    // 3. Tabel — bola × kun: katakda holat (kelgan bo'lsa Face ID kelish vaqti), rang holatga qarab
    if (days.length && days.length <= MAX_TABEL_DAYS) {
      const wt = wb.addWorksheet("Tabel", { views: [{ state: "frozen", xSplit: 3, ySplit: 4 }] });
      const n = 3 + days.length + 1;
      titleBlock(wt, "Davomat tabeli", Math.min(n, 14));
      wt.columns = [{ width: 5 }, { width: 26 }, { width: 14 }, ...days.map(() => ({ width: 7 })), { width: 9 }];
      const hr = wt.addRow(["№", "F.I.Sh.", "Guruh", ...days.map((day) => `${Number(day.slice(8))}\n${weekday(day).slice(0, 3)}`), "Keldi"]);
      head(hr);
      hr.height = 30;
      const byKey = new Map(rows.map((r) => [`${r.childId}|${r.day}`, r]));
      children.forEach((c, i) => {
        const cells = days.map((day) => {
          const r = byKey.get(`${c.id}|${day}`);
          if (!r) return "";
          return came(r.status) && r.checkIn ? r.checkIn : STATUS_SHORT[r.status] ?? r.status;
        });
        const row = wt.addRow([i + 1, c.fullName, c.group?.name ?? "—", ...cells, tally(rows.filter((r) => r.childId === c.id)).present]);
        days.forEach((day, k) => {
          const cell = row.getCell(4 + k);
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.font = { size: 9 };
          const r = byKey.get(`${c.id}|${day}`);
          const fill = r ? STATUS_FILL[r.status] : ["Shanba", "Yakshanba"].includes(weekday(day)) ? "FFF2F2F2" : undefined;
          if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        });
        row.getCell(n).alignment = { horizontal: "center" };
        row.getCell(n).font = { bold: true };
      });
      wt.addRow([]);
      const legend = wt.addRow(["", "✓ / vaqt — keldi (vaqt — Face ID orqali kelgan), Kech — kech qoldi, ✕ — kelmadi, Kasal. Kulrang — dam olish kuni."]);
      legend.getCell(2).font = { italic: true, size: 9, color: { argb: "FF6D6D72" } };
    }

    // 4. Kunlar — har kuni nechta bola kelgan
    if (days.length) {
      const wk = wb.addWorksheet("Kunlar", { views: [{ state: "frozen", ySplit: 4 }] });
      const kcols = ["№", "Sana", "Hafta kuni", "Keldi", "shundan kech", "Kelmadi", "Kasal", "Belgilanmagan", "Davomat"];
      wk.columns = [5, 16, 12, 9, 11, 10, 9, 13, 10].map((width) => ({ width }));
      titleBlock(wk, "Kunlar bo'yicha", kcols.length);
      head(wk.addRow(kcols));
      let i = 0;
      for (const day of days) {
        const mine = rows.filter((r) => r.day === day);
        if (!mine.length) continue;
        const t = tally(mine);
        const row = wk.addRow([i + 1, dayLabel(day), weekday(day), t.present, t.late || null, t.absent || null, t.sick || null, Math.max(children.length - mine.length, 0) || null, rate(t.present, markedOf(t))]);
        row.getCell(9).numFmt = PERCENT;
        [4, 5, 6, 7, 8, 9].forEach((col) => (row.getCell(col).alignment = { horizontal: "center" }));
        zebra(row, i++);
      }
      const kt = wk.addRow(["", "Jami", `${i} kun`, all.present, all.late, all.absent, all.sick, "", allRate]);
      kt.getCell(9).numFmt = PERCENT;
      [4, 5, 6, 7, 9].forEach((col) => (kt.getCell(col).alignment = { horizontal: "center" }));
      totalRow(kt);
    }

    // 5. Batafsil — har bir yozuv
    const wd = wb.addWorksheet("Batafsil", { views: [{ state: "frozen", ySplit: 4 }] });
    const dcols = ["№", "Sana", "Hafta kuni", "F.I.Sh.", "Guruh", "Holat", "Kelish", "Ketish", "Manba", "Izoh", "Ota-ona sababi"];
    wd.columns = [6, 16, 12, 28, 16, 12, 9, 9, 10, 26, 28].map((width) => ({ width }));
    titleBlock(wd, "Davomat yozuvlari", dcols.length);
    head(wd.addRow(dcols));
    rows.forEach((r, i) => {
      const row = wd.addRow([i + 1, dayLabel(r.day), weekday(r.day), r.name, r.group, STATUS_UZ[r.status] ?? r.status, r.checkIn ?? "", r.checkOut ?? "", r.checkIn ? "Face ID" : "Qo'lda", r.note, r.parentReason]);
      [7, 8].forEach((col) => (row.getCell(col).alignment = { horizontal: "center" }));
      zebra(row, i);
      row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[r.status] ?? "FFFFFFFF" } };
    });
    const dt = wd.addRow(["", "Jami", "", `${rows.length} ta yozuv`, "", `${all.present} ta keldi`]);
    totalRow(dt);
    wd.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: dcols.length } };

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= new Date(`${to}T00:00:00Z`).getTime(); t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
