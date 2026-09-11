/**
 * Osmon holati: kun, shafaq (tong/oqshom) yoki tun — haqiqiy quyosh chiqishi
 * va botishiga qarab. Hammasi shu yerda, brauzerda hisoblanadi: tarmoqqa
 * chiqilmaydi, ruxsat so'ralmaydi.
 *
 * Quyosh vaqti NOAA (AQSh okean va atmosfera boshqarmasi) formulasi bilan
 * topiladi — aniqligi bir daqiqa atrofida. Joylashuv filial manzilidan
 * olinadi: O'zbekiston shaharlari jadvalida qidiriladi, topilmasa Toshkent.
 * Bu muhim — Nukus bilan Andijon orasida quyosh botishi qariyb bir soat farq
 * qiladi.
 */

export type SkyPhase = "kun" | "shafaq" | "tun";

export interface SkyState {
  phase: SkyPhase;
  /** Oy fazasi: 0 — yangi oy, 0.5 — to'lin oy, 1 — yana yangi oy. */
  moonPhase: number;
  /** Holat keyingi safar qachon o'zgaradi (ms, UTC). */
  nextChange: number;
  /** Bugungi quyosh chiqishi va botishi (ms, UTC) — ko'rsatish yoki tekshirish uchun. */
  sunrise: number | null;
  sunset: number | null;
}

interface Coords {
  lat: number;
  lng: number;
}

const TASHKENT: Coords = { lat: 41.3111, lng: 69.2797 };

/**
 * Shaharlar: lotin va kirill yozuvdagi nomlari bilan. Qidiruv "ichida bor"
 * usulida — "Namangan Shahri", "Namangan sh.", "г. Наманган" hammasi topiladi.
 */
const CITIES: Array<{ keys: string[]; lat: number; lng: number }> = [
  { keys: ["toshkent", "tashkent", "тошкент", "ташкент"], lat: 41.3111, lng: 69.2797 },
  { keys: ["andijon", "andijan", "андижон", "андижан"], lat: 40.7821, lng: 72.3442 },
  { keys: ["namangan", "наманган"], lat: 40.9983, lng: 71.6726 },
  { keys: ["farg'ona", "fargona", "fergana", "фарғона", "фаргона", "фергана"], lat: 40.3842, lng: 71.7843 },
  { keys: ["qo'qon", "qoqon", "kokand", "қўқон", "кокон", "коканд"], lat: 40.5286, lng: 70.9425 },
  { keys: ["marg'ilon", "margilon", "margilan", "марғилон", "маргилан"], lat: 40.4715, lng: 71.7247 },
  { keys: ["samarqand", "samarkand", "самарқанд", "самарканд"], lat: 39.6542, lng: 66.9597 },
  { keys: ["buxoro", "bukhara", "бухоро", "бухара"], lat: 39.7681, lng: 64.4556 },
  { keys: ["navoiy", "navoi", "навоий", "навои"], lat: 40.0844, lng: 65.3792 },
  { keys: ["zarafshon", "зарафшон", "зарафшан"], lat: 41.5833, lng: 64.2 },
  { keys: ["qarshi", "karshi", "қарши", "карши"], lat: 38.8606, lng: 65.7891 },
  { keys: ["shahrisabz", "шаҳрисабз", "шахрисабз"], lat: 39.0578, lng: 66.8339 },
  { keys: ["termiz", "termez", "термиз", "термез"], lat: 37.2242, lng: 67.2783 },
  { keys: ["denov", "денов", "денау"], lat: 38.2772, lng: 67.8917 },
  { keys: ["jizzax", "jizzakh", "жиззах", "джизак"], lat: 40.1158, lng: 67.8422 },
  { keys: ["guliston", "gulistan", "гулистон", "гулистан"], lat: 40.4897, lng: 68.7842 },
  { keys: ["sirdaryo", "сирдарё", "сырдарья"], lat: 40.8378, lng: 68.66 },
  { keys: ["urganch", "urgench", "урганч", "ургенч"], lat: 41.5506, lng: 60.6317 },
  { keys: ["xiva", "khiva", "хива"], lat: 41.3783, lng: 60.3639 },
  { keys: ["nukus", "нукус"], lat: 42.4531, lng: 59.6103 },
  { keys: ["chirchiq", "chirchik", "чирчиқ", "чирчик"], lat: 41.469, lng: 69.5822 },
  { keys: ["angren", "ангрен"], lat: 41.0167, lng: 70.1436 },
  { keys: ["olmaliq", "almalyk", "олмалиқ", "алмалык"], lat: 40.8444, lng: 69.5983 },
  { keys: ["bekobod", "bekabad", "бекобод", "бекабад"], lat: 40.2206, lng: 69.2697 },
  { keys: ["yangiyo'l", "yangiyol", "yangiyul", "янгийўл", "янгиюль"], lat: 41.1122, lng: 69.0472 },
];

/** Har xil apostrof va katta-kichik harflarni bir ko'rinishga keltiradi. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[ʻʼ’‘`´]/g, "'");
}

/** Manzil yoki filial nomidan koordinata. Topilmasa — Toshkent. */
export function resolveCoords(...texts: Array<string | null | undefined>): Coords {
  for (const text of texts) {
    if (!text) continue;
    const haystack = normalize(text);
    for (const city of CITIES) {
      if (city.keys.some((key) => haystack.includes(key))) return { lat: city.lat, lng: city.lng };
    }
  }
  return TASHKENT;
}

const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;

/**
 * Berilgan UTC kun uchun quyosh chiqishi va botishi (ms, UTC). NOAA "Solar
 * Calculator" formulasi; ufqdagi atmosfera sinishi hisobga olingan (90.833°).
 * Qutb kunlarida (quyosh chiqmasa yoki botmasa) null.
 */
export function sunTimes(dayStartUtc: number, { lat, lng }: Coords): { rise: number; set: number } | null {
  // Yulian asri — shu kunning UTC tush paytiga nisbatan
  const jd = dayStartUtc / DAY_MS + 2440587.5 + 0.5;
  const T = (jd - 2451545) / 36525;

  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * RAD) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const appLong = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const obliq0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliq = obliq0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(obliq * RAD) * Math.sin(appLong * RAD));

  const y = Math.tan((obliq * RAD) / 2) ** 2;
  // Vaqt tenglamasi — daqiqalarda
  const eqTime =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));

  const cosHA = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  if (cosHA < -1 || cosHA > 1) return null;
  const ha = Math.acos(cosHA) / RAD;

  const noon = 720 - 4 * lng - eqTime; // UTC daqiqalarda
  return { rise: dayStartUtc + (noon - ha * 4) * 60_000, set: dayStartUtc + (noon + ha * 4) * 60_000 };
}

/** Sinodik oy — ikki yangi oy orasidagi o'rtacha vaqt (kun). */
const SYNODIC_MONTH = 29.530588853;
/** Ma'lum yangi oy: 2000-yil 6-yanvar, 18:14 UTC. */
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

/** Oy fazasi: 0 — yangi oy, 0.5 — to'lin oy. */
export function moonPhase(now: number): number {
  const days = (now - NEW_MOON_REF) / DAY_MS;
  return (((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH) / SYNODIC_MONTH;
}

// Shafaq oynalari: quyosh botishidan oldin va keyin, chiqishidan oldin va keyin
const DUSK_BEFORE = 35 * 60_000;
const DUSK_AFTER = 25 * 60_000;
const DAWN_BEFORE = 25 * 60_000;
const DAWN_AFTER = 20 * 60_000;

/**
 * Hozirgi osmon holati. Kecha, bugun va ertangi kunning quyosh vaqtlari
 * olinib, ulardan hozirgi paytga eng yaqin o'tgan va kelgusi hodisa
 * topiladi — yarim tun atrofida sana almashishi hisobni buzmaydi.
 */
export function computeSky(now: number, coords: Coords): SkyState {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const events: Array<{ kind: "rise" | "set"; t: number }> = [];
  for (const offset of [-1, 0, 1]) {
    const times = sunTimes(today + offset * DAY_MS, coords);
    if (times) events.push({ kind: "rise", t: times.rise }, { kind: "set", t: times.set });
  }
  events.sort((a, b) => a.t - b.t);
  const todayTimes = sunTimes(today, coords);
  const base = { moonPhase: moonPhase(now), sunrise: todayTimes?.rise ?? null, sunset: todayTimes?.set ?? null };

  const prev = [...events].reverse().find((event) => event.t <= now);
  const next = events.find((event) => event.t > now);
  if (!prev || !next) {
    // Qutb kuni/tuni — soatga qarab taxmin: bunday joyda bog'chamiz yo'q
    const hour = new Date(now).getHours();
    return { ...base, phase: hour >= 6 && hour < 19 ? "kun" : "tun", nextChange: now + 60 * 60_000 };
  }

  if (next.kind === "set") {
    // Kunduz: quyosh chiqqan, hali botmagan
    if (now < prev.t + DAWN_AFTER) return { ...base, phase: "shafaq", nextChange: prev.t + DAWN_AFTER };
    if (now >= next.t - DUSK_BEFORE) return { ...base, phase: "shafaq", nextChange: next.t + DUSK_AFTER };
    return { ...base, phase: "kun", nextChange: next.t - DUSK_BEFORE };
  }
  // Tun: quyosh botgan, hali chiqmagan
  if (now < prev.t + DUSK_AFTER) return { ...base, phase: "shafaq", nextChange: prev.t + DUSK_AFTER };
  if (now >= next.t - DAWN_BEFORE) return { ...base, phase: "shafaq", nextChange: next.t + DAWN_AFTER };
  return { ...base, phase: "tun", nextChange: next.t - DAWN_BEFORE };
}
