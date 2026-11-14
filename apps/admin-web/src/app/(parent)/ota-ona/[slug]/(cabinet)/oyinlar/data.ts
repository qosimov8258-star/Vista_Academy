/**
 * O'yinlar bo'limining ma'lumotlari: mavzular (rasm to'plamlari), darajalar
 * va o'yinlar ro'yxati.
 *
 * Rasmlar — Microsoft Fluent Emoji (3D), MIT litsenziyasi:
 * https://github.com/microsoft/fluentui-emoji. `public/_oyinlar/<mavzu>/`
 * ichida saqlanadi — tashqi saytga so'rov ketmaydi, internet sekin bo'lsa
 * ham o'yin ishlaydi. Keyinchalik o'zimizning rasmlar bilan almashtirish
 * uchun faqat shu fayldagi `image` yo'llarini o'zgartirish kifoya.
 *
 * Mavzular boshqa o'yinlarda ham ishlatiladi («Kim qichqirdi?» — hayvonlar,
 * «Nechta?» — mevalar), shuning uchun ular o'yinga bog'lanmagan.
 */

export type GameItem = {
  id: string;
  /** Bolaga aytiladigan nom — `tr()` orqali tarjima qilinadi */
  name: string;
  image: string;
};

export type TopicTone = "mint" | "coral" | "sky" | "lilac" | "sun";

export type Topic = {
  id: string;
  title: string;
  /** Karta orqa tomonining rangi va mavzu kartasi tusi */
  tone: TopicTone;
  /** Mavzu kartasida ko'rinadigan 3 ta rasm */
  cover: [string, string, string];
  items: GameItem[];
};

const animal = (id: string, name: string): GameItem => ({ id, name, image: `/_oyinlar/hayvonlar/${id}.png` });
const fruit = (id: string, name: string): GameItem => ({ id, name, image: `/_oyinlar/mevalar/${id}.png` });

export const TOPICS: Topic[] = [
  {
    id: "hayvonlar",
    title: "Hayvonlar",
    tone: "mint",
    cover: ["lion", "cat", "rabbit"],
    items: [
      animal("cat", "Mushuk"),
      animal("dog", "Kuchukcha"),
      animal("cow", "Sigir"),
      animal("horse", "Ot"),
      animal("sheep", "Qo'y"),
      animal("chicken", "Tovuq"),
      animal("duck", "O'rdak"),
      animal("rabbit", "Quyon"),
      animal("elephant", "Fil"),
      animal("lion", "Sher"),
      animal("monkey", "Maymun"),
      animal("bear", "Ayiq"),
    ],
  },
  {
    id: "mevalar",
    title: "Mevalar",
    tone: "coral",
    cover: ["strawberry", "apple", "banana"],
    items: [
      fruit("apple", "Olma"),
      fruit("pear", "Nok"),
      fruit("banana", "Banan"),
      fruit("grapes", "Uzum"),
      fruit("tangerine", "Mandarin"),
      fruit("lemon", "Limon"),
      fruit("strawberry", "Qulupnay"),
      fruit("cherries", "Gilos"),
      fruit("watermelon", "Tarvuz"),
      fruit("peach", "Shaftoli"),
      fruit("pineapple", "Ananas"),
      fruit("kiwi", "Kivi"),
    ],
  },
];

/** Hali qo'shilmagan mavzular — ota-ona nima kutayotganini bilsin */
export const SOON_TOPICS = ["Sabzavotlar", "Transport", "Kasblar", "Ranglar"] as const;

export function findTopic(id: string): Topic | undefined {
  return TOPICS.find((topic) => topic.id === id);
}

export function topicCover(topic: Topic): GameItem[] {
  return topic.cover.map((id) => topic.items.find((item) => item.id === id)).filter((item): item is GameItem => !!item);
}

/* ------------------------------------------------------------------------ */
/* «Juftini top» darajalari                                                  */
/* ------------------------------------------------------------------------ */

export type LevelId = "oson" | "orta" | "qiyin";

export type Level = {
  id: LevelId;
  title: string;
  age: string;
  pairs: number;
  /** Telefonda (tik holatda) ustunlar va qatorlar; yotiq ekranda almashadi */
  cols: number;
  rows: number;
  /**
   * O'yin boshida hamma rasm shuncha vaqt ochiq turadi — kichkintoy qayerda
   * nima borligini ko'rib oladi. Qiyin darajada yo'q.
   */
  peekMs: number;
};

export const LEVELS: Level[] = [
  { id: "oson", title: "Oson", age: "3–4 yosh", pairs: 3, cols: 2, rows: 3, peekMs: 3000 },
  { id: "orta", title: "O'rtacha", age: "4–5 yosh", pairs: 6, cols: 3, rows: 4, peekMs: 1500 },
  { id: "qiyin", title: "Qiyin", age: "6–7 yosh", pairs: 8, cols: 4, rows: 4, peekMs: 0 },
];

export function findLevel(id: string | null | undefined): Level {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function nextLevel(level: Level): Level | null {
  const index = LEVELS.findIndex((item) => item.id === level.id);
  return LEVELS[index + 1] ?? null;
}

/**
 * Yulduzchalar. Bola hech qachon «yutqazmaydi» — kamida bitta yulduz oladi.
 * Eng kam urinish = juftlar soni. Mezonlar yumshoq: 3 yoshli bola uchun
 * ham erishsa bo'ladigan.
 *   3★ — urinishlar ≤ juft + juft/2 (oson: ≤5, o'rta: ≤9, qiyin: ≤12)
 *   2★ — urinishlar ≤ 2·juft + 1   (oson: ≤7, o'rta: ≤13, qiyin: ≤17)
 */
export function starsFor(pairs: number, moves: number): 1 | 2 | 3 {
  if (moves <= pairs + Math.ceil(pairs / 2)) return 3;
  if (moves <= pairs * 2 + 1) return 2;
  return 1;
}

/* ------------------------------------------------------------------------ */
/* O'yinlar ro'yxati                                                         */
/* ------------------------------------------------------------------------ */

export type GameInfo = {
  id: string;
  title: string;
  description: string;
  age: string;
  skill: string;
  tone: TopicTone;
  /** null — hali tayyor emas */
  href: string | null;
};

export const GAMES: GameInfo[] = [
  {
    id: "juftini-top",
    title: "Juftini top",
    description: "Kartalarni ochib, bir xil rasmlarni toping",
    age: "3–7 yosh",
    skill: "Xotira va diqqat",
    tone: "mint",
    href: "/oyinlar/juftini-top",
  },
  {
    id: "kim-qichqirdi",
    title: "Kim qichqirdi?",
    description: "Ovozni eshitib, hayvonni toping",
    age: "2–4 yosh",
    skill: "Eshitish",
    tone: "sun",
    href: null,
  },
  {
    id: "nechta",
    title: "Nechta?",
    description: "Sanab, to'g'ri raqamni tanlang",
    age: "4–6 yosh",
    skill: "Sanash",
    tone: "sky",
    href: null,
  },
];
