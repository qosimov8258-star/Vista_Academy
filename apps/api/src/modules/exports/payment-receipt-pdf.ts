import PDFDocument from "pdfkit";
import { drawZeeronLogo } from "./zeeron-logo";

/**
 * To'lov kvitansiyasi (A5) — ota-onaga beriladigan qog'oz tasdiqnoma.
 * Tepada bog'cha belgisi va nomi, o'rtada summa (raqam va yozuvda) hamda
 * "TO'LANDI" muhri, pastda Zeeron platformasi belgisi.
 */
export type PaymentReceiptData = {
  number: string;
  organizationName: string;
  branchName: string;
  branchAddress: string | null;
  /** Filial logotipi (faqat jpeg/png — pdfkit boshqasini o'qimaydi) */
  branchLogo: Buffer | null;
  childName: string;
  childPublicId: string;
  amount: number;
  currency: string;
  methodLabel: string;
  periods: { period: string; amount: number }[];
  paidAt: Date;
  recordedBy: string | null;
  note: string | null;
  refunded: { at: Date | null; reason: string | null } | null;
};

const INK = "#1C1917";
const MUTED = "#78716C";
const HAIRLINE = "#E7E5E4";
const PANEL = "#F7F5F2";
const CRIMSON = "#9F1239";
const GOLD = "#CA8A04";
const DARK = "#0B0B0C";
const PAID = "#15803D";
const VOID = "#B91C1C";

const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Raqamni oddiy bo'shliq bilan guruhlaydi — standart PDF shriftida NBSP belgisi yo'q. */
export function groupDigits(value: number): string {
  const [whole, fraction] = Math.abs(value).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${value < 0 ? "-" : ""}${grouped}${fraction !== "00" ? `,${fraction}` : ""}`;
}

function currencyLabel(currency: string): string {
  return currency === "UZS" ? "so'm" : currency;
}

function tashkentStamp(date: Date, withTime: boolean): string {
  const iso = new Date(date.getTime() + TASHKENT_OFFSET_MS).toISOString();
  const day = `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
  return withTime ? `${day}  ${iso.slice(11, 16)}` : day;
}

function periodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

const ONES = ["", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"];
const TENS = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"];
const SCALES = ["", "ming", "million", "milliard", "trillion"];

function triadWords(n: number): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;
  if (hundreds) words.push(ONES[hundreds], "yuz");
  if (tens) words.push(TENS[tens]);
  if (ones) words.push(ONES[ones]);
  return words;
}

/** 1 500 000 → "Bir million besh yuz ming" (kvitansiyadagi "summa yozuvda"). */
export function amountInWords(value: number): string {
  let rest = Math.floor(Math.abs(value));
  if (rest === 0) return "Nol";
  const words: string[] = [];
  for (let scale = 0; rest > 0 && scale < SCALES.length; scale++) {
    const triad = rest % 1000;
    if (triad) words.unshift(...triadWords(triad), ...(SCALES[scale] ? [SCALES[scale]] : []));
    rest = Math.floor(rest / 1000);
  }
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Helvetica (pdfkit'ning ichki shrifti) faqat WinAnsi belgilarini chiqaradi.
 * O'zbek lotinidagi «ʻ» (U+02BB) va «ʼ» (U+02BC) unda yo'q — o'rnida
 * keraksiz belgilar chiqardi («Oʻtkir»). Ularni oddiy tutuq belgisiga
 * almashtiramiz; «‘ ’» WinAnsi'da bor, ular o'zgarmaydi.
 * (Kirill yozuvi uchun Unicode shrift kerak — hozircha yo'q.)
 */
export function pdfSafeText(value: string): string {
  return value.replace(/[\u02BB\u02BC\u02B9\u02BF\u0060\u00B4]/g, "'");
}

function sanitize(data: PaymentReceiptData): PaymentReceiptData {
  const t = (v: string) => pdfSafeText(v);
  const n = (v: string | null) => (v === null ? null : pdfSafeText(v));
  return {
    ...data,
    number: t(data.number),
    organizationName: t(data.organizationName),
    branchName: t(data.branchName),
    branchAddress: n(data.branchAddress),
    childName: t(data.childName),
    childPublicId: t(data.childPublicId),
    methodLabel: t(data.methodLabel),
    recordedBy: n(data.recordedBy),
    note: n(data.note),
    refunded: data.refunded ? { ...data.refunded, reason: n(data.refunded.reason) } : null,
  };
}

export function renderPaymentReceiptPdf(input: PaymentReceiptData): Promise<Buffer> {
  const data = sanitize(input);
  // A5 — chek/kvitansiya o'lchami; chegaralar 0, hamma narsa aniq koordinatada
  const doc = new PDFDocument({ size: "A5", margin: 0, info: { Title: `Kvitansiya Nº ${data.number}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const W = doc.page.width;
  const H = doc.page.height;
  const PAD = 28;
  const INNER = W - PAD * 2;
  const currency = currencyLabel(data.currency);

  // Tepadagi brend chizig'i — Zeeron ranglari
  doc.rect(0, 0, W * 0.72, 5).fill(DARK);
  doc.rect(W * 0.72, 0, W * 0.18, 5).fill(CRIMSON);
  doc.rect(W * 0.9, 0, W * 0.1, 5).fill(GOLD);

  // ── Sarlavha: bog'cha belgisi + nomi | KVITANSIYA № ──
  const headerY = 28;
  const logoR = 21;
  const logoCx = PAD + logoR;
  const logoCy = headerY + logoR;
  let logoDrawn = false;
  if (data.branchLogo) {
    try {
      doc.save();
      doc.circle(logoCx, logoCy, logoR).clip();
      doc.image(data.branchLogo, PAD, headerY, { cover: [logoR * 2, logoR * 2], align: "center", valign: "center" });
      doc.restore();
      logoDrawn = true;
    } catch {
      doc.restore();
    }
  }
  if (!logoDrawn) {
    doc.circle(logoCx, logoCy, logoR).fill(DARK);
    const initial = (data.organizationName.trim()[0] ?? "B").toUpperCase();
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#FFFFFF");
    doc.text(initial, PAD, logoCy - 9, { width: logoR * 2, align: "center", lineBreak: false });
  }
  doc.circle(logoCx, logoCy, logoR).lineWidth(0.6).strokeColor(HAIRLINE).stroke();

  const titleW = 120;
  const nameX = PAD + logoR * 2 + 12;
  const nameW = W - PAD - titleW - nameX - 8;
  doc.font("Helvetica-Bold").fontSize(14).fillColor(INK);
  doc.text(data.organizationName, nameX, headerY + 2, { width: nameW, height: 34, ellipsis: true });
  let nameBottom = doc.y + 1;
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
  doc.text(data.branchName, nameX, nameBottom, { width: nameW, lineBreak: false, ellipsis: true });
  nameBottom = doc.y + 1;
  if (data.branchAddress) {
    doc.fontSize(7.5).text(data.branchAddress, nameX, nameBottom, { width: nameW, height: 20, ellipsis: true });
  }

  const titleX = W - PAD - titleW;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(CRIMSON);
  doc.text("TO'LOV KVITANSIYASI", titleX, headerY + 3, {
    width: titleW,
    align: "right",
    characterSpacing: 0.8,
    lineBreak: false,
  });
  doc.font("Helvetica-Bold").fontSize(13).fillColor(INK);
  doc.text(`Nº ${data.number}`, titleX, headerY + 16, { width: titleW, align: "right", lineBreak: false });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text(tashkentStamp(data.paidAt, false), titleX, headerY + 33, { width: titleW, align: "right", lineBreak: false });

  // Tishli ajratgich
  let y = Math.max(headerY + logoR * 2, doc.y) + 16;
  doc.save();
  doc.moveTo(PAD, y).lineTo(W - PAD, y).dash(2.5, { space: 2.5 }).lineWidth(0.8).strokeColor("#D6D3D1").stroke();
  doc.restore();
  y += 14;

  // ── Summa paneli ──
  const panelH = 96;
  doc.roundedRect(PAD, y, INNER, panelH, 10).fill(PANEL);
  doc.rect(PAD, y + 14, 3, panelH - 28).fill(data.refunded ? VOID : CRIMSON);

  const stampW = 104;
  const textX = PAD + 18;
  const textW = INNER - 18 - stampW - 10;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(MUTED);
  doc.text("TO'LANGAN SUMMA", textX, y + 14, { characterSpacing: 1, lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(26).fillColor(INK);
  const amountText = groupDigits(data.amount);
  doc.text(amountText, textX, y + 27, { lineBreak: false });
  const amountW = doc.widthOfString(amountText);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(MUTED);
  doc.text(currency, textX + amountW + 5, y + 38, { lineBreak: false });
  doc.font("Helvetica-Oblique").fontSize(8).fillColor(MUTED);
  doc.text(`${amountInWords(data.amount)} ${currency}`, textX, y + 61, { width: textW, height: 22, ellipsis: true });

  // Muhr: TO'LANDI / BEKOR QILINDI — biroz qiyshiq, haqiqiy muhrdek
  const stampColor = data.refunded ? VOID : PAID;
  const stampLabel = data.refunded ? "BEKOR QILINDI" : "TO'LANDI";
  const stampCx = W - PAD - 14 - stampW / 2;
  const stampCy = y + panelH / 2;
  doc.save();
  doc.rotate(-12, { origin: [stampCx, stampCy] });
  doc.opacity(0.88);
  doc.roundedRect(stampCx - stampW / 2, stampCy - 20, stampW, 40, 6).lineWidth(2).strokeColor(stampColor).stroke();
  doc.roundedRect(stampCx - stampW / 2 + 3, stampCy - 17, stampW - 6, 34, 4).lineWidth(0.6).strokeColor(stampColor).stroke();
  doc.font("Helvetica-Bold").fontSize(data.refunded ? 10.5 : 14).fillColor(stampColor);
  doc.text(stampLabel, stampCx - stampW / 2, stampCy - (data.refunded ? 9 : 11), {
    width: stampW,
    align: "center",
    characterSpacing: 1,
    lineBreak: false,
  });
  doc.font("Helvetica").fontSize(6).fillColor(stampColor);
  doc.text(tashkentStamp(data.paidAt, false), stampCx - stampW / 2, stampCy + 6, {
    width: stampW,
    align: "center",
    lineBreak: false,
  });
  doc.restore();

  y += panelH + 16;

  // ── Tafsilotlar ──
  const labelW = 110;
  const valueX = PAD + labelW;
  const valueW = INNER - labelW;
  const row = (label: string, value: string, opts: { bold?: boolean; color?: string } = {}) => {
    doc.font(opts.bold === false ? "Helvetica" : "Helvetica-Bold").fontSize(9.5);
    const valueH = Math.min(doc.heightOfString(value, { width: valueW, align: "right" }), 36);
    const rowH = Math.max(valueH, 11) + 12;
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
    doc.text(label, PAD, y + 7, { width: labelW - 8, lineBreak: false });
    doc.font(opts.bold === false ? "Helvetica" : "Helvetica-Bold").fontSize(9.5).fillColor(opts.color ?? INK);
    doc.text(value, valueX, y + 6, { width: valueW, align: "right", height: 36, ellipsis: true });
    y += rowH;
    doc.moveTo(PAD, y).lineTo(W - PAD, y).lineWidth(0.5).strokeColor(HAIRLINE).stroke();
  };

  doc.moveTo(PAD, y).lineTo(W - PAD, y).lineWidth(0.5).strokeColor(HAIRLINE).stroke();
  row("Bola", data.childName);
  row("Bola ID", data.childPublicId, { bold: false });
  row("To'lov turi", data.methodLabel);
  data.periods.forEach((p, index) => {
    row(index === 0 ? "To'lov davri" : "", `${periodLabel(p.period)}  ·  ${groupDigits(p.amount)} ${currency}`, {
      bold: false,
    });
  });
  row("To'lov sanasi", tashkentStamp(data.paidAt, true), { bold: false });
  if (data.recordedBy) row("Qabul qildi", data.recordedBy);
  if (data.note) row("Izoh", data.note, { bold: false });
  if (data.refunded) {
    if (data.refunded.at) row("Bekor qilingan", tashkentStamp(data.refunded.at, true), { color: VOID });
    if (data.refunded.reason) row("Sabab", data.refunded.reason, { bold: false, color: VOID });
  }

  const footerTop = H - 66;

  // Yirtiladigan chek qirrasi
  doc.save();
  doc.moveTo(0, footerTop);
  for (let x = 0, up = true; x <= W + 6; x += 6, up = !up) {
    doc.lineTo(x, footerTop + (up ? -2.5 : 2.5));
  }
  doc.lineWidth(0.6).strokeColor("#D6D3D1").stroke();
  doc.restore();

  // ── Pastki qism: Zeeron platformasi ──
  const brandY = footerTop + 16;
  const logoW = drawZeeronLogo(doc, PAD, brandY, 12);
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
  doc.text("platformasi orqali yaratildi", PAD + logoW + 6, brandY + 2.5, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(CRIMSON);
  doc.text("zeeron.uz", W - PAD - 100, brandY + 2.5, { width: 100, align: "right", lineBreak: false });
  doc.font("Helvetica").fontSize(6.5).fillColor("#A8A29E");
  doc.text(
    `Ushbu kvitansiya to'lov qabul qilinganini tasdiqlaydi  ·  Chop etilgan: ${tashkentStamp(new Date(), true)}`,
    PAD,
    brandY + 22,
    { width: INNER, lineBreak: false },
  );

  doc.end();
  return done;
}
