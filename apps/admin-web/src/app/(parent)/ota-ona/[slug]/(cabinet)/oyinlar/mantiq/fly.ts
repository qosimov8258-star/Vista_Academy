/**
 * Rasm bir joydan ikkinchisiga uchib boradi — «Nima keyin keladi?» da
 * tanlangan javob «?» katakchasiga, «Soyasini top» da rangli rasm
 * bosilgan soyaga, «Kichikdan kattaga» da raqamli katakchaga,
 * «Savatchaga ajrat» da savatchaga, «Nechta?» va «Qaysi harf?» da raqam
 * yoki harf bo'sh katakchaga.
 *
 *  • Yetib borganda `arrived` chaqiriladi (ovoz, katakchani to'ldirish).
 *  • To'g'ri bo'lsa — rasm o'sha yerda qoladi (uchayotgan nusxa keyin
 *    olinadi) yoki `vanish` bilan savatchaga kirib yo'qoladi.
 *  • Noto'g'ri bo'lsa — o'sha yerda chayqaladi va joyiga qaytadi.
 *
 * Uchayotgan nusxa o'yin sahnasi ichiga qo'yiladi (sahna butun ekran,
 * `position: fixed`), shuning uchun o'lchamlar sahnaga nisbatan olinadi.
 * «Harakatni kamaytirish» yoqilgan telefonda rasm darhol joyiga tushadi.
 */

const FLY_MS = 430;
const SHAKE_MS = 420;

export async function flyImage({
  from,
  to,
  src,
  text,
  right,
  vanish = false,
  arrived,
}: {
  /** Hozir rasm turgan joy (uning `<img>` i) */
  from: HTMLElement;
  /** Borib qo'nadigan joy (katakcha yoki soyaning `<img>` i) */
  to: HTMLElement;
  /** Uchadigan rasm… */
  src?: string;
  /** …yoki matn (raqam, harf) — `from` dagi shrift bilan */
  text?: string;
  right: boolean;
  /** To'g'ri bo'lsa — qo'nmasdan kichrayib yo'qoladi (savatchaga tushdi) */
  vanish?: boolean;
  arrived?: () => void;
}): Promise<void> {
  const stage = from.closest<HTMLElement>("[data-kid-stage]") ?? document.body;
  const base = stage.getBoundingClientRect();
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const node = text !== undefined ? document.createElement("span") : document.createElement("img");
  if (node instanceof HTMLImageElement) {
    node.src = src ?? "";
    node.alt = "";
    node.draggable = false;
  } else {
    const look = getComputedStyle(from);
    node.textContent = text ?? "";
    Object.assign(node.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: look.fontFamily,
      fontSize: look.fontSize,
      fontWeight: look.fontWeight,
      color: look.color,
      lineHeight: "1",
      whiteSpace: "nowrap",
    } satisfies Partial<CSSStyleDeclaration>);
  }
  Object.assign(node.style, {
    position: "absolute",
    left: `${a.left - base.left}px`,
    top: `${a.top - base.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
    objectFit: "contain",
    zIndex: "30",
    pointerEvents: "none",
    filter: "drop-shadow(0 10px 14px rgba(40, 30, 20, 0.25))",
  } satisfies Partial<CSSStyleDeclaration>);
  stage.append(node);

  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const scale = Math.min(b.width / a.width, b.height / a.height);
  const there = `translate(${dx}px, ${dy}px) scale(${scale})`;

  const run = (frames: Keyframe[], duration: number, easing: string) =>
    node.animate(frames, { duration: reduce ? 0 : duration, easing, fill: "forwards" }).finished.catch(() => undefined);

  await run([{ transform: "none" }, { transform: there }], FLY_MS, "cubic-bezier(0.3, 1.25, 0.5, 1)");

  arrived?.();
  if (right && vanish) {
    await run([{ transform: there, opacity: 1 }, { transform: `${there} scale(0.3)`, opacity: 0 }], 220, "ease-in");
    node.remove();
    return;
  }
  if (right) {
    // React katakchani to'ldirib ulgursin — keyin nusxa olinadi (miltillamaydi)
    window.setTimeout(() => node.remove(), 80);
    return;
  }

  await run(
    [
      { transform: there },
      { transform: `${there} translateX(-7px) rotate(-6deg)` },
      { transform: `${there} translateX(7px) rotate(6deg)` },
      { transform: `${there} translateX(-4px) rotate(-3deg)` },
      { transform: there },
    ],
    reduce ? 0 : SHAKE_MS,
    "ease-in-out",
  );
  if (reduce) await new Promise((resolve) => window.setTimeout(resolve, 300));
  await run([{ transform: there }, { transform: "none" }], FLY_MS, "cubic-bezier(0.32, 0.72, 0, 1)");
  node.remove();
}
