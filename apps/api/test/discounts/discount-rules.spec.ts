import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import {
  chooseDiscount,
  currentPeriod,
  discountAmountOf,
  discountAppliesIn,
  discountFor,
  discountInputError,
  phoneKey,
  surnameKey,
  type DiscountRule,
} from "../../src/modules/discounts/discount-rules";

let seq = 0;
function rule(partial: Partial<DiscountRule>): DiscountRule {
  seq += 1;
  return {
    id: `d${seq}`,
    type: "PERCENTAGE",
    scope: "PERMANENT",
    value: 10,
    startPeriod: "2026-10",
    endPeriod: null,
    isActive: true,
    createdAt: new Date(`2026-10-01T00:00:${String(seq % 60).padStart(2, "0")}Z`),
    ...partial,
  };
}

describe("Chegirma — qaysi oyda amal qiladi", () => {
  it("doimiy — boshlangan oydan boshlab, oldingi oylarda emas", () => {
    const r = rule({ startPeriod: "2026-10" });
    expect(discountAppliesIn(r, "2026-09")).toBe(false);
    expect(discountAppliesIn(r, "2026-10")).toBe(true);
    expect(discountAppliesIn(r, "2027-03")).toBe(true);
  });

  it("to'xtatilgan doimiy — to'xtatilgan oydan boshlab amal qilmaydi", () => {
    const r = rule({ startPeriod: "2026-08", endPeriod: "2026-10", isActive: false });
    expect(discountAppliesIn(r, "2026-08")).toBe(true);
    expect(discountAppliesIn(r, "2026-09")).toBe(true);
    expect(discountAppliesIn(r, "2026-10")).toBe(false);
  });

  it("shu oyda berilib shu oyda to'xtatilgan — hech qachon amal qilmaydi", () => {
    const r = rule({ startPeriod: "2026-10", endPeriod: "2026-10", isActive: false });
    expect(discountAppliesIn(r, "2026-10")).toBe(false);
  });

  it("faol emas, to'xtatilgan oyi yo'q — amal qilmaydi", () => {
    expect(discountAppliesIn(rule({ isActive: false }), "2026-10")).toBe(false);
  });

  it("bir oylik — faqat o'z oyida va faol bo'lsa", () => {
    const r = rule({ scope: "ONE_MONTH", startPeriod: "2026-11" });
    expect(discountAppliesIn(r, "2026-10")).toBe(false);
    expect(discountAppliesIn(r, "2026-11")).toBe(true);
    expect(discountAppliesIn(r, "2026-12")).toBe(false);
    expect(discountAppliesIn({ ...r, isActive: false }, "2026-11")).toBe(false);
  });
});

describe("Chegirma — bir oyda bitta qoida", () => {
  it("bir oylik doimiysini bosib ketadi", () => {
    const permanent = rule({ value: 10 });
    const oneMonth = rule({ scope: "ONE_MONTH", startPeriod: "2026-10", value: 50 });
    expect(chooseDiscount([oneMonth, permanent], "2026-10")?.id).toBe(oneMonth.id);
    expect(chooseDiscount([oneMonth, permanent], "2026-11")?.id).toBe(permanent.id);
  });

  it("bir turdagilardan eng yangisi", () => {
    const older = rule({ value: 10, createdAt: new Date("2026-10-01T00:00:00Z") });
    const newer = rule({ value: 20, createdAt: new Date("2026-10-05T00:00:00Z") });
    expect(chooseDiscount([newer, older], "2026-10")?.id).toBe(newer.id);
  });
});

describe("Chegirma — summa", () => {
  it("foiz", () => {
    expect(discountAmountOf({ type: "PERCENTAGE", value: 10 }, 2_600_000)).toBe(260_000);
    expect(discountAmountOf({ type: "PERCENTAGE", value: 150 }, 1_000_000)).toBe(1_000_000);
  });

  it("aniq summa — narxdan oshmaydi", () => {
    expect(discountAmountOf({ type: "FIXED_AMOUNT", value: 100_000 }, 2_600_000)).toBe(100_000);
    expect(discountAmountOf({ type: "FIXED_AMOUNT", value: 3_000_000 }, 2_600_000)).toBe(2_600_000);
  });

  it("yakuniy narx — 2 500 000 to'lasin, narx 2 600 000 bo'lsa 100 000 chegirma", () => {
    expect(discountAmountOf({ type: "FINAL_AMOUNT", value: 2_500_000 }, 2_600_000)).toBe(100_000);
    // Yakuniy narx oylik narxdan baland bo'lsa — chegirma yo'q (narx oshirilmaydi)
    expect(discountAmountOf({ type: "FINAL_AMOUNT", value: 3_000_000 }, 2_600_000)).toBe(0);
  });

  it("qoida yo'q yoki narx 0 — chegirma 0", () => {
    expect(discountAmountOf(null, 2_600_000)).toBe(0);
    expect(discountAmountOf({ type: "PERCENTAGE", value: 10 }, 0)).toBe(0);
  });

  it("discountFor — oy bo'yicha tanlab hisoblaydi", () => {
    const rules = [rule({ type: "FIXED_AMOUNT", value: 200_000, startPeriod: "2026-10" })];
    expect(discountFor(rules, "2026-09", 2_600_000)).toBe(0);
    expect(discountFor(rules, "2026-10", 2_600_000)).toBe(200_000);
  });
});

describe("Chegirma — tekshiruv va kalitlar", () => {
  it("kiritilgan qiymat", () => {
    expect(discountInputError("PERCENTAGE", 101)).toBe("Foizli chegirma 100% dan oshmasligi kerak");
    expect(discountInputError("FIXED_AMOUNT", -1)).toBe("Chegirma qiymati 0 dan kichik bo'lmasligi kerak");
    expect(discountInputError("FIXED_AMOUNT", 0)).toBe("Chegirma qiymatini kiriting");
    expect(discountInputError("PERCENTAGE", 15)).toBeNull();
  });

  it("familiya kaliti — Aliyev ≈ Aliyeva, To'xtayev ≈ Toʻxtayeva", () => {
    expect(surnameKey("Aliyeva")).toBe(surnameKey("Aliyev"));
    expect(surnameKey("Toʻxtayeva")).toBe(surnameKey("To'xtayev"));
    expect(surnameKey("Shuxratova")).toBe(surnameKey("Shuxratov"));
    expect(surnameKey("Li")).toBeNull();
  });

  it("telefon kaliti — oxirgi 9 raqam", () => {
    expect(phoneKey("+998 90 123 45 67")).toBe("901234567");
    expect(phoneKey("90-123-45-67")).toBe("901234567");
    expect(phoneKey("12345")).toBeNull();
  });

  it("joriy oy Toshkent vaqtida — 30 sentabr 20:00 UTC allaqachon oktabr", () => {
    expect(currentPeriod(new Date("2026-09-30T20:00:00Z"))).toBe("2026-10");
    expect(currentPeriod(new Date("2026-09-30T18:00:00Z"))).toBe("2026-09");
  });
});
