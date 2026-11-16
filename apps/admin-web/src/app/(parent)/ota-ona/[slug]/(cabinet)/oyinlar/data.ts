/**
 * O'yinlar bo'limining ma'lumotlari: mavzular (rasm to'plamlari), darajalar
 * va o'yinlar ro'yxati.
 *
 * Rasmlar — Microsoft Fluent Emoji (3D), MIT litsenziyasi:
 * https://github.com/microsoft/fluentui-emoji. `public/_oyinlar/<mavzu>/`
 * ichida saqlanadi — tashqi saytga so'rov ketmaydi, internet sekin bo'lsa
 * ham o'yin ishlaydi. Mavzular ro'yxati — topics.ts da.
 *
 * Mavzular boshqa o'yinlarda ham ishlatiladi («Kim qichqirdi?» — hayvonlar,
 * «Nechta?» — mevalar), shuning uchun ular o'yinga bog'lanmagan.
 */

export type GameItem = {
  id: string;
  /** Bolaga aytiladigan nom — `tr()` orqali tarjima qilinadi */
  name: string;
  image: string;
  /**
   * Haqiqiy surat (fon olib tashlangan). Hozircha faqat «Juftini top»da:
   * boshqa o'yinlarda bitta surat rasmlar orasida qolsa, bola ortiqchasini
   * uslubidan topib qo'yadi. Hamma mavzu suratga o'tgach — hamma joyda.
   */
  photo?: string;
};

/** «Juftini top» uchun: surat bo'lsa — surat */
export function asPhoto(item: GameItem): GameItem {
  return item.photo ? { ...item, image: item.photo } : item;
}

export type TopicTone = "mint" | "coral" | "sky" | "lilac" | "sun";

/** Mavzular guruhi — mavzu tanlash sahifasida bo'lim sarlavhasi va rang */
export type TopicGroup = {
  id: string;
  title: string;
  tone: TopicTone;
};

export type Topic = {
  id: string;
  /** Qaysi guruhga kiradi (`TOPIC_GROUPS`) */
  group: string;
  title: string;
  items: GameItem[];
};

// Mavzular ko'p bo'lgani uchun alohida faylda (topics.ts)
import { TOPICS, TOPIC_GROUPS } from "./topics";
export { TOPICS, TOPIC_GROUPS };

export function findTopic(id: string): Topic | undefined {
  return TOPICS.find((topic) => topic.id === id);
}

/** Mavzu kartasida ko'rinadigan rasmlar — birinchi uchtasi */
export function topicCover(topic: Topic): GameItem[] {
  return topic.items.slice(0, 3).map(asPhoto);
}

/** Karta orqa tomonining rangi va mavzu kartasi tusi — guruhnikidan */
export function topicTone(topic: Topic): TopicTone {
  return TOPIC_GROUPS.find((group) => group.id === topic.group)?.tone ?? "mint";
}

/** Rasmni id bo'yicha barcha mavzulardan topadi (bannerlar uchun) */
export function findItem(id: string): GameItem | undefined {
  for (const topic of TOPICS) {
    const item = topic.items.find((entry) => entry.id === id);
    if (item) return item;
  }
  return undefined;
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
/* «Kim qichqirdi?» — hayvon ovozlari                                        */
/* ------------------------------------------------------------------------ */

/**
 * Ovozlar — BigSoundBank (https://bigsoundbank.com), CC0 (jamoat mulki).
 * Asl yozuvlardan hayvon ovozi bor 1,5–2,5 soniya kesib olingan, balandligi
 * tenglashtirilgan, juda qisqalari (qo'y, echki, boyqush) ikki marta
 * takrorlangan; AAC (.m4a) — iPhone va Android'da birdek ishlaydi.
 */
export type SoundAnimal = GameItem & { sound: string };

const voiced = (id: string, name: string): SoundAnimal => ({
  id,
  name,
  image: `/_oyinlar/hayvonlar/${id}.png`,
  sound: `/_oyinlar/ovozlar/${id}.m4a`,
});

export const SOUND_ANIMALS: SoundAnimal[] = [
  voiced("cow", "Sigir"),
  voiced("cat", "Mushuk"),
  voiced("dog", "Kuchukcha"),
  voiced("rooster", "Xo'roz"),
  voiced("duck", "O'rdak"),
  voiced("sheep", "Qo'y"),
  voiced("horse", "Ot"),
  voiced("goat", "Echki"),
  voiced("chicken", "Tovuq"),
  voiced("donkey", "Eshak"),
  voiced("owl", "Boyqush"),
  voiced("bee", "Ari"),
];

/**
 * Ovozi o'xshash juftlar bitta savolda birga chiqmaydi — kichkintoy
 * ularni ajrata olmaydi va o'yin adolatsiz bo'lib qoladi.
 */
export const CONFUSABLE: ReadonlyArray<readonly [string, string]> = [
  ["rooster", "chicken"],
  ["sheep", "goat"],
];

export type SoundLevel = {
  id: LevelId;
  title: string;
  age: string;
  /** Har savolda nechta hayvon ko'rsatiladi */
  choices: number;
  /** O'yindagi savollar soni */
  rounds: number;
};

export const SOUND_LEVELS: SoundLevel[] = [
  { id: "oson", title: "Oson", age: "2–3 yosh", choices: 2, rounds: 5 },
  { id: "orta", title: "O'rtacha", age: "3–4 yosh", choices: 3, rounds: 6 },
  { id: "qiyin", title: "Qiyin", age: "4–5 yosh", choices: 4, rounds: 8 },
];

export function findSoundLevel(id: string | null | undefined): SoundLevel {
  return SOUND_LEVELS.find((level) => level.id === id) ?? SOUND_LEVELS[0];
}

export function nextSoundLevel(level: SoundLevel): SoundLevel | null {
  const index = SOUND_LEVELS.findIndex((item) => item.id === level.id);
  return SOUND_LEVELS[index + 1] ?? null;
}

/**
 * Yulduzchalar — birinchi urinishda topilgan savollar ulushi bo'yicha.
 * Xato qilsa ham o'yin davom etadi, kamida bitta yulduz.
 *   3★ — 80% va undan ko'p, 2★ — 50% va undan ko'p
 */
export function soundStarsFor(firstTry: number, rounds: number): 1 | 2 | 3 {
  const share = firstTry / rounds;
  if (share >= 0.8) return 3;
  if (share >= 0.5) return 2;
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
    href: "/oyinlar/kim-qichqirdi",
  },
  {
    id: "ortiqcha",
    title: "Ortiqchasini top",
    description: "To'rttadan qaysi biri boshqacha?",
    age: "3–7 yosh",
    skill: "Mantiq",
    tone: "lilac",
    href: "/oyinlar/ortiqcha",
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
