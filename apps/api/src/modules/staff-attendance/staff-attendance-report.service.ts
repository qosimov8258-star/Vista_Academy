import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../../database/prisma.service";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import {
  DATE_RE,
  DAY_MS,
  TASHKENT_OFFSET_MS,
  dayLabel,
  dayOf,
  excelKit,
  generatedStamp,
  periodLabelOf,
  reportFile,
  stampOf,
  timeOf,
  weekday,
  type ReportHead,
  type ReportKind,
  type ReportTheme,
} from "../cash-desk/report-kit";

const THEME: ReportTheme = { accent: "#0e7490", light: "#e0f2f7" };
/** Kunlik jadval (tabel) shu kundan uzun davrda chiqarilmaydi — juda keng bo'lib ketadi */
const MAX_TABEL_DAYS = 62;

const STATUS_UZ: Record<string, string> = { PRESENT: "Keldi", LATE: "Kech qoldi", ABSENT: "Kelmadi", SICK: "Kasal", ON_LEAVE: "Ta'til" };
/** Tabel katagidagi qisqa belgi (kelmagan kunlar uchun) */
const STATUS_SHORT: Record<string, string> = { ABSENT: "Kelmadi", SICK: "Kasal", ON_LEAVE: "Ta'til" };
const STATUS_FILL: Record<string, string> = {
  PRESENT: "FFE2F0D9",
  LATE: "FFFFF2CC",
  ABSENT: "FFFCE4E4",
  SICK: "FFFDE9D9",
  ON_LEAVE: "FFEDEDED",
};
const FACE_ID_NOTE = "Face ID";
const HOURS = "[h]:mm";

const toMinutes = (hhmm: string | null) => {
  const m = hhmm ? /^(\d{1,2}):(\d{2})$/.exec(hhmm) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const hhmm = (minutes: number | null) =>
  minutes === null ? "" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes % 60)).padStart(2, "0")}`;
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
/** Terminal voqeasidagi tanlov (bitta terminalda KIRISH/CHIQISH) */
const directionOf = (raw: unknown) => {
  const s = raw && typeof raw === "object" ? (raw as { attendanceStatus?: unknown }).attendanceStatus : undefined;
  return s === "checkIn" || s === "breakIn" || s === "overtimeIn" ? "Kirish" : s === "checkOut" || s === "breakOut" || s === "overtimeOut" ? "Chiqish" : "—";
};

interface DayRow {
  day: string;
  employeeId: string;
  name: string;
  position: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  worked: number | null;
  faceId: boolean;
  note: string;
}

interface EmployeeTotals {
  id: string;
  name: string;
  position: string;
  present: number;
  late: number;
  absent: number;
  sick: number;
  onLeave: number;
  avgIn: number | null;
  avgOut: number | null;
  worked: number;
  faceIdDays: number;
}

/**
 * Xodimlar davomati hisoboti (Excel): tanlangan davrdagi kirish/chiqish
 * vaqtlari — umumiy jamlanma, xodim × kun tabeli, batafsil ro'yxat va
 * Face ID terminalidagi har bir voqea. Kunlar filial vaqt zonasi (Toshkent)
 * bo'yicha. Ko'rinishi to'lovlar hisoboti bilan bir xil (report-kit).
 */
@Injectable()
export class StaffAttendanceReportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(caller: TenantAuthenticatedUser, kind: ReportKind, from: string | undefined, to: string | undefined, queryBranchId: string | undefined) {
    const scope = toTenantScope(caller);
    if (scope.role === "TEACHER" || scope.role === "CHEF") {
      throw new ForbiddenException("Xodimlar davomati hisobotini yuklab olish huquqingiz yo'q");
    }
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

    const dateRange = kind === "all" ? undefined : { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) };
    const records = await this.prisma.employeeAttendance.findMany({
      where: { branchId, ...(dateRange ? { date: dateRange } : {}) },
      orderBy: [{ date: "asc" }],
      select: {
        date: true,
        status: true,
        checkInTime: true,
        checkOutTime: true,
        note: true,
        employee: { select: { id: true, fullName: true, position: true } },
      },
    });
    const firstDay = kind === "all" ? records[0]?.date.toISOString().slice(0, 10) : from!;
    const lastDay = kind === "all" ? records[records.length - 1]?.date.toISOString().slice(0, 10) : to!;

    const [employees, events] = await Promise.all([
      this.prisma.employee.findMany({
        where: { branchId, OR: [{ isActive: true }, { id: { in: [...new Set(records.map((r) => r.employee.id))] } }] },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true, position: true },
      }),
      firstDay
        ? this.prisma.faceIdEvent.findMany({
            where: {
              branchId,
              employeeId: { not: null },
              eventTime: {
                gte: new Date(new Date(`${firstDay}T00:00:00.000Z`).getTime() - TASHKENT_OFFSET_MS),
                lt: new Date(new Date(`${lastDay}T00:00:00.000Z`).getTime() - TASHKENT_OFFSET_MS + DAY_MS),
              },
            },
            orderBy: { eventTime: "asc" },
            select: { eventTime: true, raw: true, verifyMode: true, employee: { select: { fullName: true, position: true } }, device: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);

    const rows: DayRow[] = records.map((r) => {
      const a = toMinutes(r.checkInTime);
      const b = toMinutes(r.checkOutTime);
      return {
        day: r.date.toISOString().slice(0, 10),
        employeeId: r.employee.id,
        name: r.employee.fullName,
        position: r.employee.position,
        status: r.status,
        checkIn: r.checkInTime,
        checkOut: r.checkOutTime,
        worked: a !== null && b !== null && b > a ? b - a : null,
        faceId: r.note === FACE_ID_NOTE,
        note: r.note && r.note !== FACE_ID_NOTE ? r.note : "",
      };
    });

    const totals: EmployeeTotals[] = employees.map((e) => {
      const mine = rows.filter((r) => r.employeeId === e.id);
      const came = mine.filter((r) => r.status === "PRESENT" || r.status === "LATE");
      return {
        id: e.id,
        name: e.fullName,
        position: e.position,
        present: came.length,
        late: mine.filter((r) => r.status === "LATE").length,
        absent: mine.filter((r) => r.status === "ABSENT").length,
        sick: mine.filter((r) => r.status === "SICK").length,
        onLeave: mine.filter((r) => r.status === "ON_LEAVE").length,
        avgIn: avg(came.map((r) => toMinutes(r.checkIn)).filter((x): x is number => x !== null)),
        avgOut: avg(came.map((r) => toMinutes(r.checkOut)).filter((x): x is number => x !== null)),
        worked: mine.reduce((s, r) => s + (r.worked ?? 0), 0),
        faceIdDays: mine.filter((r) => r.faceId).length,
      };
    });

    const head: ReportHead = {
      organization: branch.organization.name,
      branch: branch.name,
      periodLabel: periodLabelOf(kind, from, to, firstDay, lastDay),
      generatedAt: generatedStamp(),
      generatedBy: caller.fullName,
    };
    const days = firstDay ? daysBetween(firstDay, lastDay!) : [];
    const buffer = await this.excel(head, rows, totals, days, events);
    return reportFile(buffer, "xodimlar-davomati", stampOf(kind, from, to), "xlsx");
  }

  private async excel(
    d: ReportHead,
    rows: DayRow[],
    totals: EmployeeTotals[],
    days: string[],
    events: { eventTime: Date; raw: unknown; verifyMode: string | null; employee: { fullName: string; position: string } | null; device: { name: string } }[],
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = d.generatedBy;
    wb.created = new Date();
    const { head, totalRow, titleBlock, section, info, zebra } = excelKit(d, THEME);
    const came = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE");
    const sumOf = (k: keyof Pick<EmployeeTotals, "present" | "late" | "absent" | "sick" | "onLeave" | "worked" | "faceIdDays">) =>
      totals.reduce((s, t) => s + t[k], 0);

    // 1. Umumiy — ko'rsatkichlar va har xodim bo'yicha jamlanma
    const ws = wb.addWorksheet("Umumiy", { views: [{ state: "frozen", ySplit: 0 }] });
    const cols = ["№", "F.I.Sh.", "Lavozim", "Keldi (kun)", "shundan kech", "Kelmadi", "Kasal", "Ta'til", "O'rtacha kirish", "O'rtacha chiqish", "Ishlagan vaqti", "Face ID bilan"];
    ws.columns = [5, 28, 22, 11, 11, 10, 9, 9, 12, 12, 13, 12].map((width) => ({ width }));
    titleBlock(ws, "Xodimlar davomati", cols.length);
    info(
      ws,
      [
        ["Davr", d.periodLabel],
        ["Xodimlar", `${totals.length} ta`],
        ["Kelgan kunlar (jami)", `${sumOf("present")} ta`],
        ["Kech qolgan", `${sumOf("late")} marta`],
        ["Kelmagan / kasal / ta'til", `${sumOf("absent")} / ${sumOf("sick")} / ${sumOf("onLeave")}`],
        ["O'rtacha kelish vaqti", hhmm(avg(came.map((r) => toMinutes(r.checkIn)).filter((x): x is number => x !== null))) || "—"],
        ["O'rtacha ketish vaqti", hhmm(avg(came.map((r) => toMinutes(r.checkOut)).filter((x): x is number => x !== null))) || "—"],
        ["Jami ishlangan vaqt", `${hhmm(sumOf("worked"))} soat`],
        ["Tuzildi", `${d.generatedAt} · ${d.generatedBy}`],
      ],
      [],
      "Kelgan kunlar (jami)",
      cols.length,
    );
    ws.addRow([]);
    section(ws, "Xodimlar bo'yicha");
    const headerRow = ws.addRow(cols);
    head(headerRow);
    totals.forEach((t, i) => {
      const row = ws.addRow([
        i + 1,
        t.name,
        t.position,
        t.present,
        t.late || null,
        t.absent || null,
        t.sick || null,
        t.onLeave || null,
        hhmm(t.avgIn) || "—",
        hhmm(t.avgOut) || "—",
        t.worked ? t.worked / 1440 : null,
        t.faceIdDays || null,
      ]);
      row.getCell(11).numFmt = HOURS;
      [4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((c) => (row.getCell(c).alignment = { horizontal: "center" }));
      zebra(row, i);
    });
    const tr = ws.addRow(["", "Jami", `${totals.length} ta xodim`, sumOf("present"), sumOf("late"), sumOf("absent"), sumOf("sick"), sumOf("onLeave"), "", "", sumOf("worked") / 1440, sumOf("faceIdDays")]);
    tr.getCell(11).numFmt = HOURS;
    [4, 5, 6, 7, 8, 11, 12].forEach((c) => (tr.getCell(c).alignment = { horizontal: "center" }));
    totalRow(tr);
    ws.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: headerRow.number, column: cols.length } };

    // 2. Tabel — xodim × kun: katakda kirish–chiqish, rang holatga qarab
    if (days.length && days.length <= MAX_TABEL_DAYS) {
      const wt = wb.addWorksheet("Tabel", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
      const n = 2 + days.length + 1;
      titleBlock(wt, "Davomat tabeli (kirish — chiqish)", Math.min(n, 14));
      wt.columns = [{ width: 5 }, { width: 26 }, ...days.map(() => ({ width: 9 })), { width: 9 }];
      const hr = wt.addRow(["№", "F.I.Sh.", ...days.map((day) => `${Number(day.slice(8))}\n${weekday(day).slice(0, 3)}`), "Keldi"]);
      head(hr);
      hr.height = 30;
      const byKey = new Map(rows.map((r) => [`${r.employeeId}|${r.day}`, r]));
      totals.forEach((t, i) => {
        const cells = days.map((day) => {
          const r = byKey.get(`${t.id}|${day}`);
          if (!r) return "";
          if (r.status === "PRESENT" || r.status === "LATE") return `${r.checkIn ?? "—"}\n${r.checkOut ?? "—"}`;
          return STATUS_SHORT[r.status] ?? STATUS_UZ[r.status] ?? r.status;
        });
        const row = wt.addRow([i + 1, t.name, ...cells, t.present]);
        row.height = 30;
        days.forEach((day, k) => {
          const cell = row.getCell(3 + k);
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          cell.font = { size: 9 };
          const r = byKey.get(`${t.id}|${day}`);
          const fill = r ? STATUS_FILL[r.status] : weekday(day) === "Yakshanba" ? "FFF2F2F2" : undefined;
          if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        });
        row.getCell(n).alignment = { horizontal: "center", vertical: "middle" };
        row.getCell(n).font = { bold: true };
      });
      wt.addRow([]);
      const legend = wt.addRow(["", "Yashil — keldi, sariq — kech qoldi, qizil — kelmadi, kulrang — ta'til/yakshanba. Katakda yuqorida kirish, pastda chiqish vaqti."]);
      legend.getCell(2).font = { italic: true, size: 9, color: { argb: "FF6D6D72" } };
    }

    // 3. Kirish-chiqish — har kun, har xodim
    const wd = wb.addWorksheet("Kirish-chiqish", { views: [{ state: "frozen", ySplit: 4 }] });
    const dcols = ["№", "Sana", "Hafta kuni", "F.I.Sh.", "Lavozim", "Holat", "Kirish", "Chiqish", "Ishlagan vaqti", "Manba", "Izoh"];
    wd.columns = [5, 16, 12, 28, 22, 12, 9, 9, 13, 10, 28].map((width) => ({ width }));
    titleBlock(wd, "Kirish va chiqish vaqtlari", dcols.length);
    head(wd.addRow(dcols));
    rows.forEach((r, i) => {
      const row = wd.addRow([
        i + 1,
        dayLabel(r.day),
        weekday(r.day),
        r.name,
        r.position,
        STATUS_UZ[r.status] ?? r.status,
        r.checkIn ?? "",
        r.checkOut ?? "",
        r.worked !== null ? r.worked / 1440 : null,
        r.faceId ? "Face ID" : "Qo'lda",
        r.note,
      ]);
      row.getCell(9).numFmt = HOURS;
      [7, 8, 9].forEach((c) => (row.getCell(c).alignment = { horizontal: "center" }));
      zebra(row, i);
      row.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[r.status] ?? "FFFFFFFF" } };
    });
    const dt = wd.addRow(["", "Jami", "", `${rows.length} ta yozuv`, "", `${came.length} ta keldi`, "", "", sumOf("worked") / 1440]);
    dt.getCell(9).numFmt = HOURS;
    totalRow(dt);
    wd.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: dcols.length } };

    // 4. Face ID voqealari — terminaldagi har bir yuz ko'rsatish (nizoli holatlar uchun)
    if (events.length) {
      const we = wb.addWorksheet("Face ID voqealari", { views: [{ state: "frozen", ySplit: 4 }] });
      const ecols = ["№", "Sana", "Vaqt", "F.I.Sh.", "Lavozim", "Tanlov", "Terminal"];
      we.columns = [6, 16, 8, 28, 22, 10, 24].map((width) => ({ width }));
      titleBlock(we, "Face ID terminali voqealari", ecols.length);
      head(we.addRow(ecols));
      events.forEach((e, i) => {
        const dir = directionOf(e.raw);
        const row = we.addRow([i + 1, dayLabel(dayOf(e.eventTime)), timeOf(e.eventTime), e.employee?.fullName ?? "", e.employee?.position ?? "", dir, e.device.name]);
        row.getCell(3).alignment = { horizontal: "center" };
        row.getCell(6).font = { bold: true, color: { argb: dir === "Kirish" ? "FF248A3D" : dir === "Chiqish" ? "FF0062CC" : "FF8E8E93" } };
        zebra(row, i);
      });
      const et = we.addRow(["", "Jami", "", `${events.length} ta voqea`]);
      totalRow(et);
      we.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: ecols.length } };
    }

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
