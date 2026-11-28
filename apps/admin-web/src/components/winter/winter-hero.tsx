/**
 * Rangli bosh karta uchun qishki manzara: to'lqinlanuvchi shimol yog'dusi,
 * pastki burchaklarda qorli archalar va kirgandan keyin asta qalinlashadigan
 * qor uyumi. Karta `position: relative; overflow: hidden` bo'lishi kerak va
 * pastida ~28px bo'sh joy qoldirsin (archalar mazmun ortida turadi).
 * Uslublari — `winter.css` (`.winter-aurora`, `.winter-pines`, `.winter-drift`).
 */

/**
 * Qorli archa (uch qavat shox) — SVG yo'llari: siluet va har qavat ustidagi qor.
 * `x` — o'rtasi, `base` — tagi, `h` — bo'yi. Shoxlar uchi biroz osilgan.
 */
function pine(x: number, base: number, h: number): { tree: string; snow: string } {
  const w = h * 0.5;
  const r = (v: number) => Math.round(v * 10) / 10;
  let tree = "";
  let snow = "";
  for (let i = 0; i < 3; i++) {
    const top = base - h + h * 0.24 * i;
    const th = h * (0.38 + i * 0.04);
    const hw = (w / 2) * (0.55 + i * 0.225);
    const bottom = top + th;
    tree += `M${r(x)} ${r(top)}L${r(x + hw)} ${r(bottom)}Q${r(x)} ${r(bottom - h * 0.06)} ${r(x - hw)} ${r(bottom)}Z`;
    // Qavat ustidagi qor — shox chetlari bo'ylab, pastki qirrasi to'lqinli
    const k = 0.42;
    snow += `M${r(x)} ${r(top)}L${r(x + hw * k)} ${r(top + th * k)}Q${r(x + hw * 0.2)} ${r(top + th * 0.33)} ${r(x)} ${r(top + th * 0.45)}Q${r(x - hw * 0.2)} ${r(top + th * 0.33)} ${r(x - hw * k)} ${r(top + th * k)}Z`;
  }
  const tw = w * 0.07;
  tree += `M${r(x - tw)} ${base}V${r(base - h * 0.12)}H${r(x + tw)}V${base}Z`;
  return { tree, snow };
}

const join = (list: { tree: string; snow: string }[]) => ({
  tree: list.map((p) => p.tree).join(""),
  snow: list.map((p) => p.snow).join(""),
});
/** Chap burchakdagi archazor (140×56): orqada xira kichiklari, oldinda kattalari */
const PINES_BACK = join([pine(14, 56, 30), pine(52, 56, 26), pine(86, 56, 22), pine(118, 56, 17)]);
const PINES_FRONT = join([pine(30, 56, 46), pine(68, 56, 36), pine(100, 56, 25)]);

function PineCluster({ mirror }: { mirror: boolean }) {
  return (
    <svg
      viewBox="0 0 140 56"
      width="140"
      height="56"
      className="absolute bottom-0"
      style={mirror ? { right: -4, transform: "scaleX(-1)" } : { left: -4 }}
    >
      <path d={PINES_BACK.tree} fill="#0d2c5c" fillOpacity="0.42" />
      <path d={PINES_BACK.snow} fill="#ffffff" fillOpacity="0.38" />
      <path d={PINES_FRONT.tree} fill="#08204a" fillOpacity="0.62" />
      <path d={PINES_FRONT.snow} fill="#ffffff" fillOpacity="0.85" />
    </svg>
  );
}

/**
 * `behind` — karta mazmuni `relative` bo'lmasa: manzara mazmun ortiga tushadi
 * (karta o'zi `isolation: isolate` bo'lishi kerak, aks holda fon ortida qoladi).
 * `aurora={false}` — yorqin (to'q sariq va h.k.) kartada: yog'du u yerda
 * oqarib, oq matnni xiralashtiradi; faqat archalar va qor uyumi qoladi.
 * `crisp` — tiniq variant: vertikal «parda» nurli yog'du va mayda yulduzlar
 * (to'q tungi osmonli kartaga — ota-ona bosh kartasi).
 */
export function WinterHeroScene({
  behind = false,
  aurora = true,
  crisp = false,
}: {
  behind?: boolean;
  aurora?: boolean;
  crisp?: boolean;
}) {
  const layer = behind ? { zIndex: -1 } : undefined;
  return (
    <>
      {crisp && <span aria-hidden="true" className="winter-stars" style={layer} />}
      {aurora && (
        <span aria-hidden="true" className={crisp ? "winter-aurora winter-aurora--crisp" : "winter-aurora"} style={layer}>
          <span className="winter-aurora-a" />
          <span className="winter-aurora-b" />
        </span>
      )}
      <span aria-hidden="true" className="winter-pines" style={layer}>
        <PineCluster mirror={false} />
        <PineCluster mirror />
        {/* Qor uyumi — kirganda yupqa, asta qalinlashadi */}
        <svg viewBox="0 0 400 18" preserveAspectRatio="none" className="winter-drift" width="100%" height="18">
          <defs>
            <linearGradient id="winterDriftFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#dce8f8" />
            </linearGradient>
          </defs>
          <path
            d="M0 9C30 3 58 4 86 8S140 13 172 8 236 2 270 7 330 12 362 6 392 4 400 5V18H0Z"
            fill="url(#winterDriftFill)"
            fillOpacity="0.94"
          />
        </svg>
      </span>
    </>
  );
}
