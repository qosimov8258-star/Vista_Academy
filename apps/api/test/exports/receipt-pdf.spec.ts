import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { amountInWords, pdfSafeText, renderPaymentReceiptPdf } from "../../src/modules/exports/payment-receipt-pdf";

describe("to'lov kvitansiyasi", () => {
  it("o'zbekcha tutuq belgilari shriftda bor belgiga almashtiriladi", () => {
    expect(pdfSafeText("Oʻtkir Gʻulomov maʼlumot")).toBe("O'tkir G'ulomov ma'lumot");
    expect(pdfSafeText("to‘lov")).toBe("to‘lov");
  });

  it("summa so'z bilan", () => {
    expect(amountInWords(1250000)).toBe("Bir million ikki yuz ellik ming");
  });

  it("PDF yaratiladi (to'langan va bekor qilingan)", async () => {
    const base = {
      number: "KV-1", organizationName: "Test", branchName: "1-filial", branchAddress: null, branchLogo: null,
      childName: "Oʻtkirov Ali", childPublicId: "id1", amount: 500000, currency: "UZS", methodLabel: "Naqd",
      periods: [{ period: "2026-11", amount: 500000 }], paidAt: new Date(), recordedBy: null, note: null, refunded: null,
    };
    const paid = await renderPaymentReceiptPdf(base);
    const voided = await renderPaymentReceiptPdf({ ...base, refunded: { at: new Date(), reason: "Xato" } });
    expect(paid.subarray(0, 4).toString()).toBe("%PDF");
    expect(voided.length > 1000).toBe(true);
  });
});
