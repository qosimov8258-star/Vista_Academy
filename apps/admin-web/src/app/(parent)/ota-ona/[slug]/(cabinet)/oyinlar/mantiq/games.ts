import type { LevelId, TopicTone } from "../data";

/**
 * Kichkintoylar uchun mantiqiy o'yinlar: «Nima keyin keladi?», «Soyasini
 * top», «Kichikdan kattaga», «Kim nima yeydi?», «Savatchaga ajrat», hamda
 * maktabga tayyorlovchi «Nechta?» (sanash) va «Qaysi harf?» (bosh harf).
 *
 * Hammasi bir xil tuzilgan: daraja tanlanadi, bir necha savol beriladi,
 * oxirida yulduzcha. Shuning uchun ro'yxat, daraja sahifasi va o'yin
 * qobig'i umumiy (`intro.tsx`, `stage.tsx`), har o'yinning faqat taxtasi
 * alohida. Savollar `rounds.ts` da tuziladi.
 *
 * Bu fayl faqat matn va sonlardan iborat — `data.ts` (o'yinlar ro'yxati)
 * uni bemalol import qiladi.
 */

export type LogicGameId =
  | "keyingisi"
  | "soyasini-top"
  | "kichikdan-kattaga"
  | "kim-nima-yeydi"
  | "savatcha"
  | "nechta"
  | "qaysi-harf";

export type LogicLevel = {
  id: LevelId;
  title: string;
  age: string;
  /** O'yindagi savollar soni */
  rounds: number;
  hint: string;
};

export type LogicGame = {
  id: LogicGameId;
  title: string;
  description: string;
  age: string;
  skill: string;
  tone: TopicTone;
  levels: LogicLevel[];
  /** «Qanday o'ynaladi?» qadamlari */
  steps: string[];
  /** O'yinning foydasi — ota-ona uchun */
  benefit: string;
};

export const LOGIC_GAMES: LogicGame[] = [
  {
    id: "keyingisi",
    title: "Nima keyin keladi?",
    description: "Qatorni davom ettiring: keyingisi qaysi?",
    age: "3–6 yosh",
    skill: "Ketma-ketlik",
    tone: "sky",
    levels: [
      { id: "oson", title: "Oson", age: "3–4 yosh", rounds: 5, hint: "Ikki rasm navbat bilan keladi: olma, sabzi, olma, sabzi…" },
      { id: "orta", title: "O'rtacha", age: "4–5 yosh", rounds: 5, hint: "Bir rasm ikki marta takrorlanadi: olma, olma, sabzi…" },
      { id: "qiyin", title: "Qiyin", age: "5–6 yosh", rounds: 5, hint: "Uch xil rasm navbat bilan keladi, javob — to'rttadan biri." },
    ],
    steps: [
      "Ekranda qator chiqadi: rasmlar bir tartibda takrorlanadi.",
      "Oxirida «?» turibdi — keyingisi qaysi?",
      "Pastdagi javoblardan birini bosing — u «?» o'rniga uchib boradi.",
      "Adashsangiz, rasm o'z joyiga qaytadi — yana urinib ko'ring.",
    ],
    benefit: "Qonuniyatni ko'rishni o'rgatadi — matematika va mantiqiy fikrlashning poydevori.",
  },
  {
    id: "soyasini-top",
    title: "Soyasini top",
    description: "Rasmga qarab, uning soyasini toping",
    age: "2–5 yosh",
    skill: "Ko'rib idrok qilish",
    tone: "lilac",
    levels: [
      { id: "oson", title: "Oson", age: "2–3 yosh", rounds: 5, hint: "Ikkita soya, ular butunlay boshqacha." },
      { id: "orta", title: "O'rtacha", age: "3–4 yosh", rounds: 5, hint: "Uchta soya." },
      { id: "qiyin", title: "Qiyin", age: "4–5 yosh", rounds: 5, hint: "To'rtta soya, hammasi bir guruhdan — bir-biriga o'xshaydi." },
    ],
    steps: [
      "Tepada rangli rasm chiqadi.",
      "Pastda — soyalar. Qaysi biri shu rasmniki?",
      "Soyani bosing — rasm o'sha soyaga uchib kiradi.",
      "To'g'ri bo'lsa, soya rangga kiradi; adashsangiz, rasm joyiga qaytadi.",
    ],
    benefit: "Shaklni ajratish va diqqatni o'stiradi — keyin harflarni farqlashga yordam beradi.",
  },
  {
    id: "kichikdan-kattaga",
    title: "Kichikdan kattaga",
    description: "Eng kichigidan boshlab bosing",
    age: "3–6 yosh",
    skill: "Taqqoslash",
    tone: "sun",
    levels: [
      { id: "oson", title: "Oson", age: "3–4 yosh", rounds: 5, hint: "Uchta rasm: kichik, o'rtacha, katta." },
      { id: "orta", title: "O'rtacha", age: "4–5 yosh", rounds: 5, hint: "To'rtta rasm." },
      { id: "qiyin", title: "Qiyin", age: "5–6 yosh", rounds: 5, hint: "Beshta rasm." },
    ],
    steps: [
      "Bir xil rasm har xil kattalikda chiqadi.",
      "Eng kichigini toping va bosing.",
      "U pastdagi katakchaga uchib boradi. Keyin undan kattarog'ini bosing.",
      "Adashsangiz, rasm katakchadan qaytib keladi — yana qidiring.",
    ],
    benefit: "«Katta–kichik», tartiblash — sanash va o'lchashga tayyorlaydi.",
  },
  {
    id: "kim-nima-yeydi",
    title: "Kim nima yeydi?",
    description: "Jonivorga uning ovqatini toping",
    age: "3–6 yosh",
    skill: "Bog'liqlik",
    tone: "mint",
    levels: [
      { id: "oson", title: "Oson", age: "3–4 yosh", rounds: 5, hint: "Ikkita ovqatdan biri." },
      { id: "orta", title: "O'rtacha", age: "4–5 yosh", rounds: 5, hint: "Uchta ovqatdan biri." },
      { id: "qiyin", title: "Qiyin", age: "5–6 yosh", rounds: 5, hint: "To'rtta ovqatdan biri." },
    ],
    steps: [
      "Tepada jonivor chiqadi.",
      "Pastdagi ovqatlardan u nima yeyishini toping.",
      "Adashsangiz, rasm chayqaladi — yana urinib ko'ring.",
    ],
    benefit: "Narsalar orasidagi bog'liqlikni tushunish, atrof-olamni bilish.",
  },
  {
    id: "savatcha",
    title: "Savatchaga ajrat",
    description: "Har birini o'z savatchasiga soling",
    age: "3–6 yosh",
    skill: "Guruhlash",
    tone: "coral",
    levels: [
      { id: "oson", title: "Oson", age: "3–4 yosh", rounds: 6, hint: "Hayvonlar va transport." },
      { id: "orta", title: "O'rtacha", age: "4–5 yosh", rounds: 6, hint: "Mevalar va sabzavotlar." },
      { id: "qiyin", title: "Qiyin", age: "5–6 yosh", rounds: 6, hint: "Uy hayvonlari va yovvoyi hayvonlar." },
    ],
    steps: [
      "O'rtada rasm chiqadi.",
      "Pastda ikkita savatcha, masalan: «Mevalar» va «Sabzavotlar».",
      "Rasm qaysi guruhga kirsa, o'sha savatchani bosing — rasm unga uchib tushadi.",
      "Adashsangiz, rasm savatchadan qaytib chiqadi — yana urinib ko'ring.",
    ],
    benefit: "Guruhlash — «bu qaysi turga kiradi?» deb o'ylash, tartibli fikrlash.",
  },
  {
    id: "nechta",
    title: "Nechta?",
    description: "Rasmlarni bittalab bosib sanang, keyin raqamni toping",
    age: "3–6 yosh",
    skill: "Sanash",
    tone: "sky",
    levels: [
      { id: "oson", title: "Oson", age: "3–4 yosh", rounds: 5, hint: "1 dan 5 gacha, 3 ta javob." },
      { id: "orta", title: "O'rtacha", age: "4–5 yosh", rounds: 5, hint: "4 dan 8 gacha, 3 ta javob." },
      { id: "qiyin", title: "Qiyin", age: "5–6 yosh", rounds: 5, hint: "6 dan 10 gacha, 4 ta javob." },
    ],
    steps: [
      "Ekranda bir nechta rasm aralash turadi.",
      "Bolangiz har birini bittalab bosib, ovoz chiqarib sanaydi — bosilgan rasmda raqam chiqadi.",
      "Keyin pastdagi raqamni bosadi — u «?» o'rniga uchib boradi.",
      "Adashib sanasa, «Qaytadan sanash» tugmasi bor.",
    ],
    benefit: "Har bir narsani bir martadan sanashni o'rgatadi: barmoq bilan bosib, ovoz chiqarib sanash — matematikaning birinchi qadami.",
  },
  {
    id: "qaysi-harf",
    title: "Qaysi harf?",
    description: "So'z qaysi harfdan boshlanishini toping",
    age: "5–7 yosh",
    skill: "Savodga tayyorlov",
    tone: "lilac",
    levels: [
      { id: "oson", title: "Oson", age: "5 yosh", rounds: 5, hint: "Oddiy harflar: O, A, B, M, S…" },
      { id: "orta", title: "O'rtacha", age: "5–6 yosh", rounds: 5, hint: "Alifboning deyarli hamma harflari." },
      { id: "qiyin", title: "Qiyin", age: "6–7 yosh", rounds: 5, hint: "Sh, Ch, O', G', Q, X — o'xshash harflar orasidan." },
    ],
    steps: [
      "Rasm chiqadi, ostida birinchi harfi tushib qolgan so'z: «?lma».",
      "So'zni bolangizga ovoz chiqarib, birinchi tovushini cho'zib o'qing: «O-o-olma».",
      "Bolangiz harfni bosadi — u bo'sh joyga uchib boradi va so'z to'ladi.",
      "Adashsa, harf o'z joyiga qaytadi — yana urinib ko'rsin.",
    ],
    benefit: "Maktabga tayyorlaydi: so'zning birinchi tovushini eshitish va uni harf bilan bog'lash — o'qishning boshlanishi.",
  },
];

export function findLogicGame(id: string | null | undefined): LogicGame | undefined {
  return LOGIC_GAMES.find((game) => game.id === id);
}

export function findLogicLevel(game: LogicGame, id: string | null | undefined): LogicLevel {
  return game.levels.find((level) => level.id === id) ?? game.levels[0];
}

export function nextLogicLevel(game: LogicGame, level: LogicLevel): LogicLevel | null {
  const index = game.levels.findIndex((item) => item.id === level.id);
  return game.levels[index + 1] ?? null;
}
