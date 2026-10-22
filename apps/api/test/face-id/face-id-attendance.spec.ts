import { beforeEach, describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { computeDailyAttendance, directionFromRaw, localDateKey, localTimeHHMM, utcWindowAround } from "../../src/modules/face-id/face-id-attendance";

const TZ = "Asia/Tashkent";
/** Toshkent vaqti (+05:00) bo'yicha Date */
const at = (hhmm: string, date = "2026-09-29") => new Date(`${date}T${hhmm}:00+05:00`);

describe("face-id davomat hisobi", () => {
  const base = { timeZone: TZ, openTime: "08:00", graceMinutes: 10 };

  it("voqea bo'lmasa — null", () => {
    expect(computeDailyAttendance([], base)).toBeNull();
  });

  it("bitta voqea: faqat kelish, ketish yo'q", () => {
    expect(computeDailyAttendance([at("07:55")], base)).toEqual({ checkInTime: "07:55", checkOutTime: null, late: false });
  });

  it("birinchi — kelish, oxirgisi — ketish (tartibsiz kelsa ham)", () => {
    const result = computeDailyAttendance([at("17:40"), at("07:58"), at("12:30")], base);
    expect(result).toEqual({ checkInTime: "07:58", checkOutTime: "17:40", late: false });
  });

  it("ketma-ket ikki marta yuz ko'rsatish ketish hisoblanmaydi (<30 daqiqa)", () => {
    expect(computeDailyAttendance([at("07:58"), at("08:05")], base)?.checkOutTime).toBeNull();
    expect(computeDailyAttendance([at("07:58"), at("08:28")], base)?.checkOutTime).toBe("08:28");
  });

  it("kechikish: ochilish + imtiyozdan keyin — LATE", () => {
    expect(computeDailyAttendance([at("08:10")], base)?.late).toBe(false);
    expect(computeDailyAttendance([at("08:11")], base)?.late).toBe(true);
  });

  it("filial ochilish vaqti belgilanmagan bo'lsa kechikish yo'q", () => {
    expect(computeDailyAttendance([at("11:00")], { ...base, openTime: null })?.late).toBe(false);
  });

  describe("terminal yo'nalish bersa (KIRISH/CHIQISH bitta terminalda)", () => {
    const kir = (hhmm: string) => ({ time: at(hhmm), direction: "in" as const });
    const chiq = (hhmm: string) => ({ time: at(hhmm), direction: "out" as const });

    it("birinchi kirish — kelgan, oxirgi chiqish — ketgan", () => {
      expect(computeDailyAttendance([chiq("17:45"), kir("07:50"), kir("08:30")], base)).toEqual({ checkInTime: "07:50", checkOutTime: "17:45", late: false });
    });

    it("faqat kirish — hali ketmagan (oralig'i katta bo'lsa ham)", () => {
      expect(computeDailyAttendance([kir("07:50"), kir("12:00")], base)?.checkOutTime).toBeNull();
    });

    it("kirishdan tez orada chiqish tanlansa ham ketgan deb yoziladi (30 daqiqa qoidasi yo'q)", () => {
      expect(computeDailyAttendance([kir("07:50"), chiq("08:05")], base)?.checkOutTime).toBe("08:05");
    });

    it("ertalab adashib bosilgan chiqish e'tiborsiz", () => {
      expect(computeDailyAttendance([chiq("07:48"), kir("07:50")], base)).toEqual({ checkInTime: "07:50", checkOutTime: null, late: false });
    });

    it("kirish tanlanmagan bo'lsa — kelgani birinchi voqea", () => {
      expect(computeDailyAttendance([chiq("08:20"), chiq("17:30")], base)).toEqual({ checkInTime: "08:20", checkOutTime: "17:30", late: true });
    });

    it("chiqib, yana kirgan bo'lsa — hali ketmagan; oxirida chiqsa — o'sha vaqt", () => {
      expect(computeDailyAttendance([kir("07:50"), chiq("13:00"), kir("14:00")], base)?.checkOutTime).toBeNull();
      expect(computeDailyAttendance([kir("07:50"), chiq("13:00"), kir("14:00"), chiq("18:10")], base)?.checkOutTime).toBe("18:10");
    });

    it("kechikish birinchi kirish bo'yicha", () => {
      expect(computeDailyAttendance([kir("08:25"), chiq("17:00")], base)?.late).toBe(true);
    });

    it("yo'nalishsiz voqealar bilan aralash — yo'nalishlilar hal qiladi", () => {
      expect(computeDailyAttendance([{ time: at("07:40") }, kir("07:55"), chiq("17:00")], base)).toEqual({ checkInTime: "07:55", checkOutTime: "17:00", late: false });
    });
  });

  it("Hikvision attendanceStatus → yo'nalish", () => {
    expect(directionFromRaw({ attendanceStatus: "checkIn", label: "KIRISH" })).toBe("in");
    expect(directionFromRaw({ attendanceStatus: "checkOut", label: "CHIQISH" })).toBe("out");
    expect(directionFromRaw({ attendanceStatus: "breakOut" })).toBe("out");
    expect(directionFromRaw({ attendanceStatus: "undefined" })).toBeNull();
    expect(directionFromRaw({})).toBeNull();
    expect(directionFromRaw(null)).toBeNull();
  });

  it("kun chegarasi Toshkent vaqti bo'yicha (UTC emas)", () => {
    // 19:30 UTC = ertasi kuni 00:30 Toshkentda
    const t = new Date("2026-09-29T19:30:00Z");
    expect(localDateKey(t, TZ)).toBe("2026-09-30");
    expect(localTimeHHMM(t, TZ)).toBe("00:30");
  });

  it("UTC oynasi mahalliy kunni to'liq qamraydi", () => {
    const w = utcWindowAround("2026-09-29");
    expect(w.from.getTime()).toBeLessThanOrEqual(at("00:00").getTime());
    expect(w.to.getTime()).toBeGreaterThan(at("23:59").getTime());
  });
});
