import { TOPICS, asPhoto, type GameItem, type LevelId } from "../data";

/**
 * «Ortiqchasini top» — to'rtta rasmdan uchtasi bitta guruhdan, bittasi
 * boshqasidan. Bola «ortiqcha»sini topadi va nega ortiqchaligini eshitadi:
 * «Mashina — transport. Qolganlari — mevalar».
 *
 * Rasmlar «Juftini top» mavzularidan olinadi, lekin har guruhdan ikki
 * xil tushunilishi mumkin bo'lganlari chiqarib tashlangan (tovuq — ham uy
 * hayvoni, ham qush; qo'ziqorin — sabzavot emas; ayiqcha — o'yinchoq, lekin
 * hayvonlar orasida bola uni ayiq deb o'ylaydi). Aks holda o'yin adolatsiz
 * bo'lib qoladi: bola to'g'ri o'ylagan bo'ladi, o'yin esa «xato» deydi.
 */

/** Oila — darajani belgilaydi: oson — turli oiladan, qiyin — bir oiladan */
export type OddFamily = "jonzot" | "ovqat" | "narsa" | "tabiat";

export type OddSet = {
  id: string;
  family: OddFamily;
  /** Bitta narsa nima: «meva», «transport» */
  kind: string;
  /** Hammasi nima: «mevalar» */
  plural: string;
  items: GameItem[];
};

const SETS: Array<{ topic: string; family: OddFamily; kind: string; plural: string; exclude?: string[] }> = [
  { topic: "hayvonlar", family: "jonzot", kind: "uy hayvoni", plural: "uy hayvonlari", exclude: ["chicken", "rooster", "duck"] },
  { topic: "yovvoyi", family: "jonzot", kind: "yovvoyi hayvon", plural: "yovvoyi hayvonlar" },
  { topic: "qushlar", family: "jonzot", kind: "qush", plural: "qushlar" },
  { topic: "dengiz", family: "jonzot", kind: "dengiz jonzoti", plural: "dengiz jonzotlari", exclude: ["turtle", "shell"] },
  { topic: "hasharotlar", family: "jonzot", kind: "hasharot", plural: "hasharotlar", exclude: ["snail", "spider", "worm"] },
  { topic: "mevalar", family: "ovqat", kind: "meva", plural: "mevalar" },
  { topic: "sabzavotlar", family: "ovqat", kind: "sabzavot", plural: "sabzavotlar", exclude: ["mushroom"] },
  { topic: "shirinliklar", family: "ovqat", kind: "shirinlik", plural: "shirinliklar", exclude: ["croissant", "popcorn", "pie"] },
  { topic: "transport", family: "narsa", kind: "transport", plural: "transport vositalari" },
  { topic: "kiyimlar", family: "narsa", kind: "kiyim", plural: "kiyimlar", exclude: ["glasses"] },
  { topic: "uy", family: "narsa", kind: "uy buyumi", plural: "uy buyumlari", exclude: ["door", "window", "key", "telephone"] },
  { topic: "maktab", family: "narsa", kind: "o'quv quroli", plural: "o'quv qurollari", exclude: ["abacus", "globe"] },
  {
    topic: "oyinchoqlar",
    family: "narsa",
    kind: "o'yinchoq",
    plural: "o'yinchoqlar",
    exclude: ["teddy", "carousel", "balloon", "gift", "scooter", "bubbles"],
  },
  { topic: "musiqa", family: "narsa", kind: "musiqa asbobi", plural: "musiqa asboblari", exclude: ["microphone", "headphone"] },
  { topic: "gullar", family: "tabiat", kind: "gul", plural: "gullar", exclude: ["cactus", "palm", "fir", "tree", "seedling", "leaf"] },
];

const setItems = (set: (typeof SETS)[number]) =>
  (TOPICS.find((item) => item.id === set.topic)?.items ?? []).filter((item) => !set.exclude?.includes(item.id));

/**
 * Suratlar faqat hamma guruhda yetarli bo'lsa ishlatiladi; aks holda hammasi
 * rasmda. Bitta savolda surat va rasm aralashsa, ortiqcha uslubidan bilinib qoladi.
 */
const PHOTOS = SETS.every((set) => setItems(set).filter((item) => item.photo).length >= 6);

export const ODD_SETS: OddSet[] = SETS.flatMap((set) => {
  const items = PHOTOS ? setItems(set).filter((item) => item.photo).map(asPhoto) : setItems(set);
  return items.length >= 3 ? [{ id: set.topic, family: set.family, kind: set.kind, plural: set.plural, items }] : [];
});

export type OddLevel = {
  id: LevelId;
  title: string;
  age: string;
  /** O'yindagi savollar soni */
  rounds: number;
  /** Ortiqcha qayerdan olinadi */
  rule: "boshqa-oila" | "aralash" | "bir-oila";
  hint: string;
};

export const ODD_LEVELS: OddLevel[] = [
  { id: "oson", title: "Oson", age: "3–4 yosh", rounds: 5, rule: "boshqa-oila", hint: "Ortiqchasi butunlay boshqacha: mevalar orasida mashina." },
  { id: "orta", title: "O'rtacha", age: "4–5 yosh", rounds: 8, rule: "aralash", hint: "Ba'zan yaqin guruhlar ham chiqadi." },
  { id: "qiyin", title: "Qiyin", age: "5–7 yosh", rounds: 10, rule: "bir-oila", hint: "Hammasi o'xshash: mevalar orasida sabzavot, uy hayvonlari orasida yovvoyi." },
];

export function findOddLevel(id: string | null | undefined): OddLevel {
  return ODD_LEVELS.find((level) => level.id === id) ?? ODD_LEVELS[0];
}

export function nextOddLevel(level: OddLevel): OddLevel | null {
  const index = ODD_LEVELS.findIndex((item) => item.id === level.id);
  return ODD_LEVELS[index + 1] ?? null;
}

export type OddCard = { item: GameItem; set: OddSet };
export type OddRound = { cards: OddCard[]; odd: OddCard; base: OddSet };

function shuffle<T>(list: readonly T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

function oddCandidates(base: OddSet, rule: OddLevel["rule"]): OddSet[] {
  const others = ODD_SETS.filter((set) => set.id !== base.id);
  if (rule === "boshqa-oila") return others.filter((set) => set.family !== base.family);
  if (rule === "bir-oila") return others.filter((set) => set.family === base.family);
  return others;
}

/**
 * Savollar: har birida asosiy guruh almashadi (ketma-ket bir xil guruh
 * chiqmaydi), rasmlar o'yin davomida takrorlanmaydi, ortiqchaning joyi
 * har safar boshqa.
 */
export function buildOddRounds(level: OddLevel): OddRound[] {
  const used = new Set<string>();
  const rounds: OddRound[] = [];
  const bases = ODD_SETS.filter((set) => oddCandidates(set, level.rule).length > 0);
  let previous: string | null = null;
  for (let n = 0; n < level.rounds; n++) {
    const fresh = (set: OddSet) => set.items.filter((item) => !used.has(item.image));
    const options = bases.filter((set) => set.id !== previous && fresh(set).length >= 3);
    const base = pick(options.length ? options : bases);
    const sameItems = shuffle(fresh(base).length >= 3 ? fresh(base) : base.items).slice(0, 3);
    const candidates = oddCandidates(base, level.rule);
    const withFresh = candidates.filter((set) => fresh(set).length > 0);
    const oddSet = pick(withFresh.length ? withFresh : candidates);
    const oddItem = pick(fresh(oddSet).length ? fresh(oddSet) : oddSet.items);
    [...sameItems, oddItem].forEach((item) => used.add(item.image));
    const odd = { item: oddItem, set: oddSet };
    rounds.push({ cards: shuffle([...sameItems.map((item) => ({ item, set: base })), odd]), odd, base });
    previous = base.id;
  }
  return rounds;
}
