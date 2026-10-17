import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import {
  FEATURE_CATALOG,
  disabledFeatureKeys,
  blockedFeatureForRequest,
  blockedFieldForRequest,
  featuresForRequest,
  resolveFeatures,
} from "../../src/common/features/feature-catalog";

describe("feature-catalog", () => {
  it("kalitlar takrorlanmaydi", () => {
    const keys = FEATURE_CATALOG.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("bo'sh sozlamada hammasi yoqilgan", () => {
    expect(disabledFeatureKeys({}, {})).toEqual([]);
  });

  it("bog'cha sozlamasi tarifni bekor qiladi", () => {
    expect(disabledFeatureKeys({ crm: false, hr: false }, { crm: true })).toEqual(["hr"]);
    expect(resolveFeatures({ crm: true }, { crm: false }).crm).toBe(false);
  });

  it("panel sozlamasi bog'cha sozlamasidan ustun turadi", () => {
    const panels = { TEACHER: { crm: false, hr: true } };
    expect(disabledFeatureKeys({}, {}, "TEACHER", panels)).toEqual(["crm"]);
    expect(disabledFeatureKeys({}, {}, "MANAGER", panels)).toEqual([]);
    expect(disabledFeatureKeys({}, { hr: false }, "TEACHER", panels)).toEqual(["crm"]);
    expect(disabledFeatureKeys({}, { hr: false }, "MANAGER", panels)).toEqual(["hr"]);
  });

  const keysOf = (url: string, method = "GET") => featuresForRequest(url, method).map((f) => f.key);

  it("yo'l to'g'ri funksiyaga bog'lanadi", () => {
    expect(keysOf("/api/v1/app/leads?stage=NEW")).toEqual(["crm"]);
    expect(keysOf("/api/v1/app/children/abc/attendance-history")).toEqual(["attendance"]);
    expect(keysOf("/api/v1/app/employees/1/payroll/pay", "POST")).toEqual(["hr"]);
    expect(keysOf("/api/v1/app/parent/diary").includes("diary")).toBe(true);
    expect(keysOf("/api/v1/app/parent/children")).toEqual(["parentCabinet"]);
    expect(keysOf("/api/v1/app/finance/reminder-settings")).toEqual(["paymentReminders"]);
  });

  it("ichki funksiya metodga qarab ishlaydi", () => {
    expect(keysOf("/api/v1/app/employees/1/avatar", "PUT")).toEqual(["employees", "employeeAvatar"]);
    // rasmni ko'rish (GET) rasm funksiyasiga kirmaydi
    expect(keysOf("/api/v1/app/employees/1/avatar", "GET")).toEqual(["employees"]);
    expect(keysOf("/api/v1/app/employees", "POST")).toEqual(["employees", "employeeCreate"]);
    expect(keysOf("/api/v1/app/employees", "GET")).toEqual(["employees"]);
    expect(keysOf("/api/v1/app/employees/1", "DELETE")).toEqual(["employees", "employeeDelete"]);
  });

  it("faqat o'chirilgan ichki funksiya to'xtatadi", () => {
    const off = ["employeeAvatar"];
    expect(blockedFeatureForRequest("/api/v1/app/employees/1/avatar", "PUT", off)?.key).toBe("employeeAvatar");
    expect(blockedFeatureForRequest("/api/v1/app/employees/1/avatar", "GET", off)).toBeNull();
    expect(blockedFeatureForRequest("/api/v1/app/employees", "GET", off)).toBeNull();
  });

  it("asosiy bo'lim o'chsa ichkilari ham o'chadi, ish haqi esa alohida qoladi", () => {
    const off = disabledFeatureKeys({}, { employees: false });
    expect(off.includes("employeeAvatar")).toBe(true);
    expect(off.includes("employeeCreate")).toBe(true);
    expect(off.includes("hr")).toBe(false);
    expect(blockedFeatureForRequest("/api/v1/app/employees/1/payroll", "GET", off)).toBeNull();
    // ichki funksiyani qo'lda yoqish asosiy o'chiq bo'lsa foyda bermaydi
    expect(disabledFeatureKeys({}, { employees: false, employeeAvatar: true }).includes("employeeAvatar")).toBe(true);
  });

  it("o'chirilgan forma maydoni so'rov tanasida kelsa rad etiladi", () => {
    const off = ["childFieldBirthDate"];
    expect(blockedFieldForRequest("/api/v1/app/children", "POST", { firstName: "A", birthDate: "2021-01-01" }, off)?.field).toBe("birthDate");
    expect(blockedFieldForRequest("/api/v1/app/children/abc", "PATCH", { birthDate: "2021-01-01" }, off)?.field).toBe("birthDate");
    // bo'sh yoki yuborilmagan maydon to'sqinlik qilmaydi
    expect(blockedFieldForRequest("/api/v1/app/children", "POST", { firstName: "A" }, off)).toBeNull();
    expect(blockedFieldForRequest("/api/v1/app/children", "POST", { birthDate: "" }, off)).toBeNull();
    // funksiya yoqilgan bo'lsa yoki boshqa yo'l bo'lsa — o'tadi
    expect(blockedFieldForRequest("/api/v1/app/children", "POST", { birthDate: "2021-01-01" }, [])).toBeNull();
    expect(blockedFieldForRequest("/api/v1/app/employees", "POST", { birthDate: "2021-01-01" }, off)).toBeNull();
  });

  it("cheklanmaydigan yo'llar bo'sh qaytaradi", () => {
    expect(keysOf("/api/v1/app/auth/me")).toEqual([]);
    expect(keysOf("/api/v1/app/children")).toEqual([]);
    expect(keysOf("/api/v1/platform/plans")).toEqual([]);
  });

  it("xonalar «Qo'shimcha darslar» bilan birga yopiladi", () => {
    const off = ["lessons"];
    expect(blockedFeatureForRequest("/api/v1/app/rooms", "GET", off)?.key).toBe("lessons");
    expect(blockedFeatureForRequest("/api/v1/app/rooms/r1", "PATCH", off)?.key).toBe("lessons");
    expect(blockedFeatureForRequest("/api/v1/app/lesson-schedules/check", "POST", off)?.key).toBe("lessons");
    expect(blockedFeatureForRequest("/api/v1/app/rooms", "GET", [])).toBeNull();
  });
});
