"use client";

import type { Poem, Tale } from "./content";

/**
 * She'r va ertakni rasm (PNG) qilib tayyorlash va saqlash.
 *
 * Rasm canvas'da chiziladi — kutubxona yo'q, sahifadan skrinshot olinmaydi:
 * shu tufayli har qanday telefonda bir xil chiqadi va matn tiniq bo'ladi.
 * O'lcham 1080×1920 — Telegram/Instagram statuslari uchun qulay. Pastki
 * chekkada bog'cha nomi turadi: ota-ona rasmni ulashsa, bog'cha ham ko'rinadi.
 *
 * Rasm doim yorug' ohangda — kabinetda qorong'i rejim tanlangan bo'lsa ham.
 */

const W = 1080;
const H = 1920;
const FONT = `ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif`;
const INK = "#2c2320";
const BODY = "#3d322c";
const MUTED = "#8a7d75";

const CARD_X = 48;
const CARD_Y = 48;
const CARD_W = W - CARD_X * 2;
const FOOTER_H = 176;
const CARD_H = H - CARD_Y - FOOTER_H;
const PAD = 64;
const CONTENT_X = CARD_X + PAD;
const CONTENT_W = CARD_W - PAD * 2;

type Ctx = CanvasRenderingContext2D;
type Palette = { top: string; blobs: ReadonlyArray<readonly [x: number, y: number, r: number, color: string]> };

const POEM_PALETTE: Palette = {
  top: "#fff1d9",
  blobs: [
    [0.92, 0.03, 0.6, "rgba(255, 183, 3, 0.32)"],
    [0.02, 0.36, 0.55, "rgba(167, 139, 250, 0.22)"],
    [0.96, 0.88, 0.6, "rgba(63, 191, 155, 0.2)"],
    [0.08, 0.02, 0.45, "rgba(86, 180, 245, 0.18)"],
  ],
};

const TALE_PALETTE: Palette = {
  top: "#e6f2ff",
  blobs: [
    [0.9, 0.04, 0.6, "rgba(86, 180, 245, 0.3)"],
    [0.04, 0.42, 0.55, "rgba(167, 139, 250, 0.22)"],
    [0.94, 0.9, 0.55, "rgba(255, 183, 3, 0.22)"],
    [0.1, 0.96, 0.5, "rgba(63, 191, 155, 0.18)"],
  ],
};

const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

/** Nomda "bog'cha" so'zi bo'lmasa qo'shiladi: "Usmon" → "Usmon bog'chasi" */
const HAS_KINDERGARTEN = /bog['ʻʼ’‘`]?ch/i;
export function kindergartenLabel(name: string): string {
  return HAS_KINDERGARTEN.test(name) ? name : `${name} bog'chasi`;
}

function createCanvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas mavjud emas");
  ctx.textBaseline = "middle";
  return [canvas, ctx];
}

/** Harf oralig'i — eski brauzerlarda yo'q, bo'lmasa shunchaki o'tkazib yuboriladi */
function setSpacing(ctx: Ctx, value: string) {
  const c = ctx as Ctx & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = value;
}

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** So'zlar bo'yicha qatorlarga bo'lish */
function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsize(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** To'rt uchli uchqun */
function drawSparkle(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0);
  ctx.quadraticCurveTo(r * 0.12, r * 0.12, 0, r);
  ctx.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0);
  ctx.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r);
  ctx.fill();
  ctx.restore();
}

function starPath(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Bandlar orasidagi bezak: nuqta — yulduzcha — nuqta */
function drawDivider(ctx: Ctx, cx: number, cy: number, color: string) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.5;
  circle(ctx, cx - 36, cy, 5);
  circle(ctx, cx + 36, cy, 5);
  ctx.globalAlpha = 1;
  starPath(ctx, cx, cy, 15);
  ctx.fill();
}

/** Uycha belgisi — bog'cha nomi yonida */
function drawHouse(ctx: Ctx, cx: number, cy: number, size: number) {
  const u = size / 24;
  ctx.save();
  ctx.translate(cx - 12 * u, cy - 12 * u);
  ctx.scale(u, u);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(12, 3);
  ctx.lineTo(21.5, 11);
  ctx.lineTo(19, 11);
  ctx.lineTo(19, 20.5);
  ctx.lineTo(5, 20.5);
  ctx.lineTo(5, 11);
  ctx.lineTo(2.5, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffb703";
  roundedRect(ctx, 10, 14, 4, 6.5, 1.2);
  ctx.fill();
  ctx.restore();
}

function drawBackground(ctx: Ctx, height: number, palette: Palette) {
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, palette.top);
  base.addColorStop(0.5, "#fffaf4");
  base.addColorStop(1, "#ffffff");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, height);
  for (const [fx, fy, fr, color] of palette.blobs) {
    const x = fx * W;
    const y = fy * height;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, fr * W);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, height);
  }
}

function drawCard(ctx: Ctx, cardH: number) {
  ctx.save();
  ctx.shadowColor = "rgba(120, 90, 70, 0.16)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 18;
  roundedRect(ctx, CARD_X, CARD_Y, CARD_W, cardH, 56);
  ctx.fillStyle = "rgba(255, 255, 255, 0.93)";
  ctx.fill();
  ctx.restore();
  roundedRect(ctx, CARD_X, CARD_Y, CARD_W, cardH, 56);
  ctx.strokeStyle = "rgba(255, 183, 3, 0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Karta burchaklaridagi "stikerlar" */
function drawStickers(ctx: Ctx, cardH: number, where: "top" | "bottom") {
  const right = CARD_X + CARD_W;
  const bottom = CARD_Y + cardH;
  if (where === "top") {
    drawSparkle(ctx, right - 44, CARD_Y + 44, 30, "#ffc94a");
    drawSparkle(ctx, right - 100, CARD_Y + 92, 15, "#a78bfa");
    ctx.fillStyle = "#ff8fa3";
    circle(ctx, right - 36, CARD_Y + 118, 7);
  } else {
    drawSparkle(ctx, right - 48, bottom - 48, 28, "#ffc94a");
    drawSparkle(ctx, right - 104, bottom - 30, 13, "#a78bfa");
  }
  drawSparkle(ctx, CARD_X + 40, bottom - 44, 18, "#56b4f5");
}

function drawChip(ctx: Ctx, text: string, x: number, y: number, align: "center" | "left", bg: string, fg: string) {
  ctx.font = font(800, 26);
  setSpacing(ctx, "3px");
  const w = ctx.measureText(text).width + 48;
  const left = align === "center" ? x - w / 2 : x;
  roundedRect(ctx, left, y, w, 52, 26);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.fillText(text, left + w / 2 + 1.5, y + 27);
  ctx.textAlign = "left";
  setSpacing(ctx, "0px");
}

/** Pastki chekka: uycha belgisi, bog'cha nomi; o'ngda sahifa raqami */
function drawFooter(ctx: Ctx, height: number, brand: string, right: string | null) {
  const cy = height - FOOTER_H / 2 + 6;
  const bx = 76 + 40;
  ctx.fillStyle = "#ffb703";
  circle(ctx, bx, cy, 40);
  drawHouse(ctx, bx, cy - 1, 40);

  const tx = bx + 40 + 24;
  const maxW = right ? 640 : 820;
  const hasWord = HAS_KINDERGARTEN.test(brand);
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = font(800, 42);
  if (hasWord) {
    ctx.fillText(ellipsize(ctx, brand, maxW), tx, cy + 2);
  } else {
    ctx.fillText(ellipsize(ctx, brand, maxW), tx, cy - 16);
    ctx.font = font(600, 28);
    ctx.fillStyle = MUTED;
    ctx.fillText("bog'chasi", tx, cy + 26);
  }
  if (right) {
    ctx.font = font(700, 30);
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    ctx.fillText(right, W - 76, cy + 2);
    ctx.textAlign = "left";
  }
}

async function fontsReady() {
  try {
    await document.fonts?.ready;
  } catch {
    // Shrift tayyor bo'lmasa ham chizamiz
  }
}

function toFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], name, { type: "image/png" })) : reject(new Error("Rasm yaratilmadi"))),
      "image/png",
    );
  });
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[ʻʼ’‘'`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "bogcha";
}

/** Sahifadagi SVG (ertak muqovasi) → rasm; canvas'ga chizish uchun */
async function svgToImage(svg: SVGSVGElement, width: number, height: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("class");
  let markup = new XMLSerializer().serializeToString(clone);
  if (!markup.includes('xmlns="http://www.w3.org/2000/svg"')) {
    markup = markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();
  return image;
}

/* ---------------------------------------------------------------------------
 * She'r — bitta rasm
 * ------------------------------------------------------------------------ */

export async function renderPoemImage(poem: Poem, brand: string): Promise<File> {
  await fontsReady();
  const [, m] = createCanvas(8, 8);

  const CHIP_H = 52;
  const HEAD_GAP = 32;
  const TITLE_LH = 104;
  const AUTHOR_H = poem.author ? 56 : 0;
  const AFTER_TITLE = 72;
  const DIVIDER_H = 76;

  m.font = font(800, 88);
  const titleLines = wrapText(m, poem.title, CONTENT_W);
  const lines = poem.stanzas.flat();
  const bodyHeight = (size: number) =>
    poem.stanzas.reduce((sum, stanza, i) => sum + stanza.length * Math.round(size * 1.55) + (i > 0 ? DIVIDER_H : 0), 0);
  const contentHeight = (size: number) =>
    CHIP_H + HEAD_GAP + titleLines.length * TITLE_LH + AUTHOR_H + AFTER_TITLE + bodyHeight(size);

  // She'r qatori bo'linmaydi: eng uzuni sig'maguncha va butun she'r kartaga
  // joylashguncha shrift kichrayadi. Qisqa she'r katta harflarda chiqadi.
  let size = 62;
  for (; size > 34; size -= 2) {
    m.font = font(600, size);
    const widest = Math.max(0, ...lines.map((line) => m.measureText(line).width));
    if (widest <= CONTENT_W && contentHeight(size) <= CARD_H - PAD * 2) break;
  }
  const lineH = Math.round(size * 1.55);
  const contentH = contentHeight(size);
  // Juda uzun she'r — rasm pastga cho'ziladi
  const cardH = Math.max(CARD_H, contentH + PAD * 2);
  const height = CARD_Y + cardH + FOOTER_H;

  const [canvas, ctx] = createCanvas(W, height);
  drawBackground(ctx, height, POEM_PALETTE);
  drawCard(ctx, cardH);

  let y = CARD_Y + Math.max(PAD, (cardH - contentH) / 2);
  drawChip(ctx, "SHE'R", W / 2, y, "center", "rgba(167, 139, 250, 0.18)", "#6d4fd1");
  y += CHIP_H + HEAD_GAP;

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = font(800, 88);
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y + TITLE_LH / 2);
    y += TITLE_LH;
  }
  if (poem.author) {
    ctx.font = font(600, 34);
    ctx.fillStyle = MUTED;
    ctx.fillText(poem.author, W / 2, y + AUTHOR_H / 2);
    y += AUTHOR_H;
  }
  drawDivider(ctx, W / 2, y + AFTER_TITLE / 2, "#a78bfa");
  y += AFTER_TITLE;

  poem.stanzas.forEach((stanza, i) => {
    if (i > 0) {
      drawDivider(ctx, W / 2, y + DIVIDER_H / 2, "#ffb703");
      y += DIVIDER_H;
    }
    ctx.textAlign = "center";
    ctx.font = font(600, size);
    ctx.fillStyle = BODY;
    for (const line of stanza) {
      ctx.fillText(line, W / 2, y + lineH / 2);
      y += lineH;
    }
  });
  ctx.textAlign = "left";

  drawStickers(ctx, cardH, "top");
  drawFooter(ctx, height, brand, null);
  return toFile(canvas, `${slugify(poem.title)}.png`);
}

/* ---------------------------------------------------------------------------
 * Ertak — kitob kabi bir necha sahifa
 * ------------------------------------------------------------------------ */

interface Block {
  h: number;
  /** Oldingi blokdan bo'shliq; sahifa boshida hisobga olinmaydi */
  gapBefore: number;
  /** Keyingisi bilan bir sahifada qolsin (sarlavha yolg'iz qolmasin) */
  keepWithNext?: boolean;
  draw: (ctx: Ctx, y: number) => void;
}

export async function renderTaleImages(tale: Tale, brand: string, cover: SVGSVGElement | null): Promise<File[]> {
  await fontsReady();
  const [, m] = createCanvas(8, 8);
  const bottom = CARD_Y + CARD_H - PAD;

  const COVER_X = CARD_X + 28;
  const COVER_Y = CARD_Y + 28;
  const COVER_W = CARD_W - 56;
  const COVER_H = Math.round((COVER_W * 9) / 16);
  const TITLE_LH = 88;
  const ORIGIN_H = 52;
  const HEADER_H = 64;

  m.font = font(800, 76);
  const titleLines = wrapText(m, tale.title, CONTENT_W);
  const titleTop = cover ? COVER_Y + COVER_H + 44 : CARD_Y + PAD;
  const firstStart = titleTop + titleLines.length * TITLE_LH + ORIGIN_H + 40;
  const otherStart = CARD_Y + PAD + HEADER_H + 28;

  // --- Bloklar: matn qatorlari, saboq qutisi, savollar ---
  const TEXT = 42;
  const TEXT_LH = 68;
  const blocks: Block[] = [];
  m.font = font(500, TEXT);
  tale.paragraphs.forEach((paragraph, p) => {
    wrapText(m, paragraph, CONTENT_W).forEach((line, i) => {
      blocks.push({
        h: TEXT_LH,
        gapBefore: i === 0 && p > 0 ? 28 : 0,
        draw: (ctx, y) => {
          ctx.font = font(500, TEXT);
          ctx.fillStyle = BODY;
          ctx.fillText(line, CONTENT_X, y + TEXT_LH / 2);
        },
      });
    });
  });

  const MORAL_LH = 58;
  m.font = font(700, 40);
  const moralLines = wrapText(m, tale.moral, CONTENT_W - 80);
  const moralH = 40 + 34 + 18 + moralLines.length * MORAL_LH + 32;
  blocks.push({
    h: moralH,
    gapBefore: 48,
    draw: (ctx, y) => {
      roundedRect(ctx, CONTENT_X, y, CONTENT_W, moralH, 36);
      ctx.fillStyle = "rgba(255, 183, 3, 0.16)";
      ctx.fill();
      drawSparkle(ctx, CONTENT_X + CONTENT_W - 44, y + 44, 16, "#ffc94a");
      ctx.font = font(800, 26);
      setSpacing(ctx, "3px");
      ctx.fillStyle = "#a8720a";
      ctx.fillText("ERTAK SABOQI", CONTENT_X + 40, y + 40 + 17);
      setSpacing(ctx, "0px");
      ctx.font = font(700, 40);
      ctx.fillStyle = INK;
      moralLines.forEach((line, i) => ctx.fillText(line, CONTENT_X + 40, y + 40 + 34 + 18 + i * MORAL_LH + MORAL_LH / 2));
    },
  });

  if (tale.questions.length > 0) {
    blocks.push({
      h: 56,
      gapBefore: 48,
      keepWithNext: true,
      draw: (ctx, y) => {
        ctx.font = font(800, 26);
        setSpacing(ctx, "3px");
        ctx.fillStyle = "#2b7fb8";
        ctx.fillText("BOLANGIZGA SO'RANG", CONTENT_X, y + 28);
        setSpacing(ctx, "0px");
      },
    });
    const Q_LH = 54;
    m.font = font(600, 38);
    tale.questions.forEach((question, i) => {
      const qLines = wrapText(m, question, CONTENT_W - 80);
      blocks.push({
        h: qLines.length * Q_LH + 8,
        gapBefore: 16,
        draw: (ctx, y) => {
          ctx.fillStyle = "rgba(86, 180, 245, 0.18)";
          circle(ctx, CONTENT_X + 26, y + Q_LH / 2, 26);
          ctx.font = font(800, 28);
          ctx.fillStyle = "#2b7fb8";
          ctx.textAlign = "center";
          ctx.fillText(String(i + 1), CONTENT_X + 26, y + Q_LH / 2 + 1);
          ctx.textAlign = "left";
          ctx.font = font(600, 38);
          ctx.fillStyle = INK;
          qLines.forEach((line, j) => ctx.fillText(line, CONTENT_X + 80, y + j * Q_LH + Q_LH / 2));
        },
      });
    });
  }

  // --- Sahifalarga taqsimlash ---
  type Placed = { block: Block; y: number };
  const pages: Placed[][] = [];
  let current: Placed[] = [];
  let y = firstStart;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const gap = current.length === 0 ? 0 : block.gapBefore;
    let need = gap + block.h;
    const next = blocks[i + 1];
    if (block.keepWithNext && next) need += next.gapBefore + next.h;
    // Birinchi sahifada joy qolmasa — u faqat muqovadan iborat bo'ladi
    if (y + need > bottom && (current.length > 0 || pages.length === 0)) {
      pages.push(current);
      current = [];
      y = otherStart;
      i--;
      continue;
    }
    y += gap;
    current.push({ block, y });
    y += block.h;
  }
  pages.push(current);
  // Oxirgi sahifada matn qayerda tugagani — bo'sh joyga yakun yoziladi
  const lastEnd = y;

  // --- Chizish ---
  const coverImage = cover ? await svgToImage(cover, COVER_W * 2, COVER_H * 2).catch(() => null) : null;
  const total = pages.length;
  const files: File[] = [];
  for (let p = 0; p < total; p++) {
    const [canvas, ctx] = createCanvas(W, H);
    drawBackground(ctx, H, TALE_PALETTE);
    drawCard(ctx, CARD_H);

    if (p === 0) {
      if (coverImage) {
        ctx.save();
        roundedRect(ctx, COVER_X, COVER_Y, COVER_W, COVER_H, 40);
        ctx.clip();
        ctx.drawImage(coverImage, COVER_X, COVER_Y, COVER_W, COVER_H);
        ctx.restore();
      }
      let ty = titleTop;
      ctx.fillStyle = INK;
      ctx.font = font(800, 76);
      for (const line of titleLines) {
        ctx.fillText(line, CONTENT_X, ty + TITLE_LH / 2);
        ty += TITLE_LH;
      }
      ctx.font = font(600, 32);
      ctx.fillStyle = MUTED;
      ctx.fillText(`${tale.origin} · ${tale.minutes} daqiqa`, CONTENT_X, ty + ORIGIN_H / 2);
    } else {
      // Keyingi sahifalarda qaysi ertak ekani tepada ko'rinib tursin
      ctx.fillStyle = "#56b4f5";
      starPath(ctx, CONTENT_X + 14, CARD_Y + PAD + HEADER_H / 2, 14);
      ctx.fill();
      ctx.font = font(800, 34);
      ctx.fillStyle = MUTED;
      ctx.fillText(tale.title, CONTENT_X + 40, CARD_Y + PAD + HEADER_H / 2);
      ctx.fillStyle = "rgba(120, 90, 70, 0.12)";
      ctx.fillRect(CONTENT_X, CARD_Y + PAD + HEADER_H, CONTENT_W, 2);
    }

    for (const { block, y: top } of pages[p]) block.draw(ctx, top);

    // Oxirgi sahifaning bo'sh qolgan pastiga — bolalar kitobidagidek yakun
    const room = bottom - lastEnd;
    if (p === total - 1 && room > 240) {
      const cy = lastEnd + room / 2 - 20;
      ctx.textAlign = "center";
      ctx.font = font(800, 72);
      ctx.fillStyle = "#ff7a66";
      ctx.fillText("Tamom!", W / 2, cy);
      const half = ctx.measureText("Tamom!").width / 2;
      drawSparkle(ctx, W / 2 - half - 52, cy - 8, 24, "#ffc94a");
      drawSparkle(ctx, W / 2 + half + 52, cy - 8, 24, "#a78bfa");
      ctx.font = font(600, 34);
      ctx.fillStyle = MUTED;
      ctx.fillText("Shirin tushlar, jajji do'stim!", W / 2, cy + 78);
      ctx.textAlign = "left";
    }

    drawStickers(ctx, CARD_H, p === 0 ? "bottom" : "top");
    drawFooter(ctx, H, brand, total > 1 ? `${p + 1} / ${total}` : null);
    files.push(await toFile(canvas, total > 1 ? `${slugify(tale.title)}-${p + 1}.png` : `${slugify(tale.title)}.png`));
  }
  return files;
}

/* ---------------------------------------------------------------------------
 * Saqlash
 * ------------------------------------------------------------------------ */

export type SaveResult = "shared" | "downloaded" | "cancelled";

/**
 * Telefonda — tizimning "Ulashish" oynasi: u yerdan "Rasmni saqlash"
 * (galereyaga) yoki to'g'ridan-to'g'ri Telegram. Veb-sahifa galereyaga o'zi
 * yoza olmaydi, bu yagona to'g'ri yo'l. Kompyuterda yoki ulashish ishlamasa —
 * oddiy yuklab olish.
 */
export async function saveImages(files: File[], title: string, text: string): Promise<SaveResult> {
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function" && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title, text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Boshqa xato — yuklab olishga o'tamiz
    }
  }
  for (let i = 0; i < files.length; i++) {
    const url = URL.createObjectURL(files[i]);
    const link = document.createElement("a");
    link.href = url;
    link.download = files[i].name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
    // Brauzer ketma-ket yuklashlarni bittaga qo'shib yubormasin
    if (i < files.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 400));
  }
  return "downloaded";
}
