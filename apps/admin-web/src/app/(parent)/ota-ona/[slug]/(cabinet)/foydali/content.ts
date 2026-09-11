"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * "Foydali" bo'limi mazmuni: she'rlar, maqollar, ertaklar.
 *
 * Hozircha namunaviy ma'lumot shu faylda turadi — tarbiyachilar yuklaydigan
 * qism (API va tarbiyachi paneli) alohida qilinmoqda. U tayyor bo'lgach faqat
 * shu yerdagi hook'larda `queryFn` so'rovga almashtiriladi va `initialData`
 * olib tashlanadi — sahifalar o'zgarmaydi.
 *
 * Kutilayotgan API (ota-ona tokeni bilan; server bolaning guruhiga mosini
 * qaytaradi):
 *   GET /app/parent/useful/poems         → Poem[]
 *   GET /app/parent/useful/poems/:id     → Poem
 *   GET /app/parent/useful/proverbs      → Proverb[]
 *   GET /app/parent/useful/tales         → Tale[]
 *   GET /app/parent/useful/tales/:id     → Tale
 */

export interface Poem {
  id: string;
  title: string;
  /** Shoir. Noma'lum bo'lsa null — sahifada ko'rsatilmaydi. */
  author: string | null;
  /** Qo'shgan tarbiyachi */
  addedBy: string;
  /** Qaysi guruh uchun; null — barcha guruhlar */
  groupName: string | null;
  ageFrom: number;
  ageTo: number;
  /** Bandlar, har biri qatorlardan iborat */
  stanzas: string[][];
  /** ISO sana (YYYY-MM-DD) */
  addedAt: string;
}

export interface Proverb {
  id: string;
  text: string;
  /** Bolaga tushuntirish uchun sodda izoh */
  meaning: string;
}

export interface Tale {
  id: string;
  title: string;
  /** Kelib chiqishi: "O'zbek xalq ertagi", muallif ismi va h.k. */
  origin: string;
  /** Taxminiy o'qish vaqti, daqiqa */
  minutes: number;
  paragraphs: string[];
  /** Ertak saboqi — nimani o'rgatadi */
  moral: string;
  /** O'qib bo'lgach bolaga beriladigan savollar */
  questions: string[];
  addedBy: string;
  /** Muqova rasmi */
  cover: "sholgom" | "tun";
  addedAt: string;
}

/*
 * Namunaviy mazmun. She'rlar shu loyiha uchun yozilgan (mualliflik huquqi
 * muammosi yo'q), maqollar — xalq og'zaki ijodi, "Sholg'om" — mashhur xalq
 * ertagining qisqa qayta hikoyasi.
 */

const POEMS: Poem[] = [
  {
    id: "quyoshcha",
    title: "Quyoshcha",
    author: null,
    addedBy: "Tarbiyachi",
    groupName: null,
    ageFrom: 3,
    ageTo: 6,
    addedAt: "2026-09-08",
    stanzas: [
      ["Tongda chiqdi quyoshcha,", "Nur sochadi oz-ozcha.", "«Uyg'on!» — dedi gullarga,", "Daraxtdagi qushlarga."],
      ["Men ham turdim ertalab,", "Yuzim yuvdim chayqalab.", "Onam kulib qaradi,", "Sochlarimni taradi."],
      ["Otam qo'lim ushladi,", "Bog'cha sari boshladi.", "Do'stlarim kutib turar,", "Quyosh ham kulib turar!"],
    ],
  },
  {
    id: "mushukcha",
    title: "Mushukcha",
    author: null,
    addedBy: "Tarbiyachi",
    groupName: null,
    ageFrom: 3,
    ageTo: 5,
    addedAt: "2026-09-05",
    stanzas: [
      ["Oppoq mushuk — Momiqvoy,", "Ko'zlari yashil, oy-oy!", "Kech kirib, men yotaman,", "Momiqni quchoqlayman."],
      ["«Miyov!» — deydi erkalab,", "Yurar dumin likillab.", "Hayvonlarni sevaylik,", "Ularga mehr beraylik!"],
    ],
  },
];

const PROVERBS: Proverb[] = [
  {
    id: "ona-yurt",
    text: "Ona yurting — oltin beshiging.",
    meaning: "Tug'ilib o'sgan yurting senga beshikdek aziz. Uni sev va asra.",
  },
  {
    id: "birlashgan",
    text: "Birlashgan o'zar, birlashmagan to'zar.",
    meaning: "Ahil, birga harakat qilganlar maqsadiga yetadi. Urishqoqlar esa hech narsaga erisha olmaydi.",
  },
  {
    id: "mehnat",
    text: "Mehnatning tagi — rohat.",
    meaning: "Kim harakat qilsa, keyin uning quvonchini ko'radi.",
  },
  {
    id: "yaxshi-soz",
    text: "Yaxshi so'z — jon ozig'i.",
    meaning: "Shirin so'z odamni xursand qiladi, unga kuch beradi. Hammaga yaxshi gapiraylik.",
  },
  {
    id: "kitob",
    text: "Kitob — bilim manbai.",
    meaning: "Kitob o'qigan bola ko'p narsani biladi.",
  },
  {
    id: "tozalik",
    text: "Tozalik — sog'liq garovi.",
    meaning: "Qo'lini yuvib, toza yurgan bola kam kasal bo'ladi.",
  },
  {
    id: "oz-oz",
    text: "Oz-oz o'rganib dono bo'lur, qatra-qatra yig'ilib daryo bo'lur.",
    meaning: "Har kuni ozgina o'rgansang, katta bilim yig'asan — xuddi tomchilardan daryo hosil bo'lgandek.",
  },
  {
    id: "sabr",
    text: "Sabr tagi — sariq oltin.",
    meaning: "Shoshilmay, sabr bilan kutgan odam yaxshi natijaga erishadi.",
  },
];

const TALES: Tale[] = [
  {
    id: "sholgom",
    title: "Sholg'om",
    origin: "Rus xalq ertagi",
    minutes: 2,
    addedBy: "Tarbiyachi",
    cover: "sholgom",
    addedAt: "2026-09-06",
    paragraphs: [
      "Bir bor ekan, bir yo'q ekan, bir bobo bor ekan. Bahorda bobo tomorqasiga sholg'om ekibdi.",
      "Sholg'om o'sibdi, o'sibdi — shunday katta bo'lib ketibdiki, hatto boboning o'zi ham hayron qolibdi.",
      "Kuz kelibdi. Bobo sholg'omni sug'urib olmoqchi bo'libdi. Tortibdi, tortibdi — sug'urib ololmabdi.",
      "Bobo momoni chaqiribdi. Momo boboni, bobo sholg'omni — tortishibdi, tortishibdi — sug'urib ololmabdi.",
      "Momo nevarasini chaqiribdi. Nevara momoni, momo boboni, bobo sholg'omni — tortishibdi, tortishibdi — yana sug'urib ololmabdi.",
      "Nevara kuchukchani chaqiribdi, kuchukcha mushukchani chaqiribdi. Hammasi birga tortishibdi — sholg'om qimirlabdi-yu, lekin chiqmabdi.",
      "Shunda mushukcha kichkina sichqonchani chaqiribdi. Sichqoncha mushukchani, mushukcha kuchukchani, kuchukcha nevarani, nevara momoni, momo boboni, bobo sholg'omni — tortishibdi, tortishibdi... va sholg'om «pat» etib yerdan chiqibdi!",
      "Hamma xursand bo'lib, sholg'omdan mazali ovqat pishiribdi va birga o'tirib, maza qilib yeyishibdi.",
    ],
    moral: "Birga, ahil bo'lsak — har qanday ishni uddalaymiz. Hatto eng kichkina yordamchi ham katta ish qila oladi!",
    questions: [
      "Bobo bahorda nima ekdi?",
      "Sholg'omni kimlar tortdi? Ularni tartib bilan ayta olasanmi?",
      "Eng oxirida kim yordamga keldi?",
      "Sen bugun kimga yordam berding?",
    ],
  },
];

// Mazmun tez-tez o'zgarmaydi — qayta so'ralmaydi
const STATIC = { staleTime: Infinity, gcTime: Infinity } as const;

export function usePoems() {
  return useQuery({ queryKey: ["useful", "poems"], queryFn: async () => POEMS, initialData: POEMS, ...STATIC });
}

export function usePoem(id: string) {
  const find = () => POEMS.find((poem) => poem.id === id) ?? null;
  return useQuery({ queryKey: ["useful", "poems", id], queryFn: async () => find(), initialData: find, ...STATIC });
}

export function useProverbs() {
  return useQuery({ queryKey: ["useful", "proverbs"], queryFn: async () => PROVERBS, initialData: PROVERBS, ...STATIC });
}

export function useTales() {
  return useQuery({ queryKey: ["useful", "tales"], queryFn: async () => TALES, initialData: TALES, ...STATIC });
}

export function useTale(id: string) {
  const find = () => TALES.find((tale) => tale.id === id) ?? null;
  return useQuery({ queryKey: ["useful", "tales", id], queryFn: async () => find(), initialData: find, ...STATIC });
}
