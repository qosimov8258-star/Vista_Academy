import { findItem, type GameItem, type LevelId } from "../data";

/**
 * Mantiqiy o'yinlarning savollari. Rasmlar — «Juftini top» mavzularidagi
 * 3D rasmlar (suratlar emas): soya va kattalik o'yinida rasmning shakli
 * aniq ko'rinishi kerak, surat esa har xil burchakdan olingan.
 *
 * Ro'yxatlar qo'lda tanlangan: soyasi bir-biriga o'xshaydigan rasmlar
 * (ayiq va panda, ot va zebra) bitta savolda chiqmaydi; bir nechta
 * jonivorga to'g'ri keladigan ovqat (mushuk ham baliq yeydi) noto'g'ri
 * javob sifatida berilmaydi. Aks holda bola to'g'ri o'ylagan bo'ladi,
 * o'yin esa «xato» deydi.
 */

const item = (id: string): GameItem => {
  const found = findItem(id);
  if (!found) throw new Error(`O'yin rasmi topilmadi: ${id}`);
  return found;
};
const items = (ids: string[]) => ids.map(item);

export function shuffle<T>(list: readonly T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** Ro'yxatdan takrorlanmaydigan n ta (`except` dagilarsiz) */
function sample(list: readonly GameItem[], n: number, except: readonly GameItem[] = []): GameItem[] {
  const skip = new Set(except.map((entry) => entry.id));
  return shuffle(list.filter((entry) => !skip.has(entry.id))).slice(0, n);
}

/* ------------------------------------------------------------------------ */
/* 1. Nima keyin keladi?                                                     */
/* ------------------------------------------------------------------------ */

/** Qatorlar shu to'plamlardan tuziladi — har savolda boshqasi */
const PATTERN_POOLS: GameItem[][] = [
  items(["apple", "banana", "grapes", "strawberry", "pear", "cherries", "watermelon", "lemon"]),
  // Bir xil yurak, rangi har xil — bola rangni ajratadi
  items(["red", "yellow", "blue", "green", "purple", "orange", "pink", "brown"]),
  items(["cat", "dog", "cow", "horse", "sheep", "rabbit", "rooster", "duck"]),
  items(["car", "bus", "bicycle", "airplane", "train", "ship", "tractor", "helicopter"]),
  items(["carrot", "cucumber", "tomato", "corn", "broccoli", "eggplant", "bell-pepper", "potato"]),
  items(["sun", "moon", "star", "cloud", "rainbow", "snowflake", "umbrella", "droplet"]),
];

/** Daraja → qonuniyat: AB (olma, sabzi…), AAB, ABC */
const PATTERN_KINDS: Record<LevelId, number[]> = {
  oson: [0, 1],
  orta: [0, 0, 1],
  qiyin: [0, 1, 2],
};

export type PatternRound = {
  /** Ko'rsatiladigan 5 ta rasm, oltinchisi — «?» */
  shown: GameItem[];
  answer: GameItem;
  options: GameItem[];
};

export function buildPatternRounds(level: LevelId, count: number): PatternRound[] {
  const offset = Math.floor(Math.random() * PATTERN_POOLS.length);
  const kinds = PATTERN_KINDS[level];
  return Array.from({ length: count }, (_, n) => {
    const pool = PATTERN_POOLS[(offset + n) % PATTERN_POOLS.length];
    const symbols = sample(pool, 3);
    const sequence = Array.from({ length: 6 }, (_, i) => symbols[kinds[i % kinds.length]]);
    const answer = sequence[5];
    // Chalg'ituvchi javoblar qatordagi boshqa rasmlardan ham chiqadi — shunisi qiziq
    const distractors = sample(pool, level === "qiyin" ? 3 : 2, [answer]);
    return { shown: sequence.slice(0, 5), answer, options: shuffle([answer, ...distractors]) };
  });
}

/* ------------------------------------------------------------------------ */
/* 2. Soyasini top                                                           */
/* ------------------------------------------------------------------------ */

/** Soyasi aniq ajraladigan rasmlar (yumaloq mevalar, yuzi chizilgan hayvonlar chiqarilgan) */
const SHADOW_GROUPS: GameItem[][] = [
  items(["cat", "dog", "cow", "horse", "sheep", "goat", "rabbit", "rooster", "duck", "camel"]),
  items(["elephant", "monkey", "giraffe", "zebra", "hedgehog", "kangaroo", "bear", "lion"]),
  items(["apple", "banana", "cherries", "grapes", "pear", "pineapple", "strawberry", "watermelon"]),
  items(["carrot", "corn", "cucumber", "eggplant", "broccoli", "garlic", "hot-pepper", "mushroom", "bell-pepper"]),
  items(["car", "bicycle", "motorcycle", "airplane", "helicopter", "ship", "train", "tractor", "fire-engine"]),
];

/** Soyalari o'xshash — bitta savolda birga chiqmaydi */
const SHADOW_CONFUSABLE: ReadonlyArray<readonly [string, string]> = [
  ["cat", "dog"],
  ["horse", "zebra"],
  ["giraffe", "zebra"],
  ["carrot", "corn"],
  ["cucumber", "eggplant"],
];

const confusable = (a: GameItem, b: GameItem) =>
  SHADOW_CONFUSABLE.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id));

export type ShadowRound = { target: GameItem; options: GameItem[] };

export function buildShadowRounds(level: LevelId, count: number): ShadowRound[] {
  const total = level === "oson" ? 2 : level === "orta" ? 3 : 4;
  const used = new Set<string>();
  return Array.from({ length: count }, () => {
    const group = pick(SHADOW_GROUPS);
    const fresh = group.filter((entry) => !used.has(entry.id));
    const target = pick(fresh.length ? fresh : group);
    used.add(target.id);
    // Oson — boshqa guruhdan (butunlay boshqacha), qiyin — o'sha guruhdan, o'rtacha — aralash
    const source =
      level === "oson"
        ? SHADOW_GROUPS.filter((entry) => entry !== group).flat()
        : level === "qiyin"
          ? group
          : SHADOW_GROUPS.flat();
    const options: GameItem[] = [target];
    for (const candidate of shuffle(source)) {
      if (options.length >= total) break;
      if (options.some((chosen) => chosen.id === candidate.id || confusable(chosen, candidate))) continue;
      options.push(candidate);
    }
    return { target, options: shuffle(options) };
  });
}

/* ------------------------------------------------------------------------ */
/* 3. Kichikdan kattaga                                                      */
/* ------------------------------------------------------------------------ */

const SIZE_ITEMS = items(["star", "apple", "bear", "balloon", "tulip", "fish", "car", "sunflower"]);

/** Kattaliklar — eng kattasiga nisbatan (5 tagacha) */
const SIZE_SCALES = [0.34, 0.5, 0.66, 0.82, 1];

export type SizeRound = {
  item: GameItem;
  /** Kichikdan kattaga tartibda */
  scales: number[];
  /** Ekrandagi aralash tartib: har biri `scales` dagi o'rni */
  order: number[];
};

export function buildSizeRounds(level: LevelId, count: number): SizeRound[] {
  const n = level === "oson" ? 3 : level === "orta" ? 4 : 5;
  const scales = SIZE_SCALES.slice(SIZE_SCALES.length - n);
  const chosen = shuffle(SIZE_ITEMS);
  return Array.from({ length: count }, (_, i) => {
    let order = shuffle(scales.map((_, rank) => rank));
    // Allaqachon to'g'ri tartibda turgan bo'lsa — yana aralashtiramiz
    while (order.every((rank, index) => rank === index)) order = shuffle(order);
    return { item: chosen[i % chosen.length], scales, order };
  });
}

/* ------------------------------------------------------------------------ */
/* 4. Kim nima yeydi?                                                        */
/* ------------------------------------------------------------------------ */

/**
 * Jonivor → ovqat. `also` — u yana yeydigan narsalar: ular shu jonivorga
 * noto'g'ri javob sifatida berilmaydi (mushuk ham baliq yeydi).
 */
const FOOD_PAIRS: Array<{ animal: string; food: string; also?: string[] }> = [
  { animal: "cat", food: "milk", also: ["fish"] },
  { animal: "rabbit", food: "carrot", also: ["leaf"] },
  { animal: "monkey", food: "banana", also: ["leaf"] },
  { animal: "bear", food: "honey", also: ["fish"] },
  { animal: "chicken", food: "corn" },
  { animal: "caterpillar", food: "leaf" },
  { animal: "bee", food: "sunflower", also: ["honey"] },
  { animal: "penguin", food: "fish" },
];

export type FoodRound = { animal: GameItem; food: GameItem; options: GameItem[] };

export function buildFoodRounds(level: LevelId, count: number): FoodRound[] {
  const total = level === "oson" ? 2 : level === "orta" ? 3 : 4;
  const pairs = shuffle(FOOD_PAIRS);
  return Array.from({ length: count }, (_, i) => {
    const pair = pairs[i % pairs.length];
    const skip = new Set([pair.food, ...(pair.also ?? [])]);
    const others = shuffle(FOOD_PAIRS.map((entry) => entry.food).filter((food) => !skip.has(food)));
    const options = [pair.food, ...others.slice(0, total - 1)].map(item);
    return { animal: item(pair.animal), food: item(pair.food), options: shuffle(options) };
  });
}

/* ------------------------------------------------------------------------ */
/* 5. Savatchaga ajrat                                                       */
/* ------------------------------------------------------------------------ */

export type Basket = {
  name: string;
  /** Savatcha belgisi — bu rasm savolda chiqmaydi */
  icon: GameItem;
  items: GameItem[];
};

const HOME_ANIMALS = ["cat", "dog", "cow", "horse", "sheep", "goat", "donkey", "chicken", "rooster", "camel"];
const WILD_ANIMALS = ["lion", "elephant", "monkey", "bear", "tiger", "fox", "wolf", "giraffe", "zebra", "panda", "hedgehog", "kangaroo"];

function basket(name: string, icon: string, ids: string[]): Basket {
  return { name, icon: item(icon), items: items(ids.filter((id) => id !== icon)) };
}

/**
 * Daraja → ikki savatcha. Ikki xil tushunilishi mumkin bo'lganlar
 * chiqarilgan: quyon va o'rdak yovvoyi ham bo'ladi, qo'ziqorin — sabzavot emas.
 */
const SORT_BASKETS: Record<LevelId, [Basket, Basket]> = {
  oson: [
    basket("Hayvonlar", "dog", [...HOME_ANIMALS, ...WILD_ANIMALS]),
    basket("Transport", "car", ["car", "bus", "truck", "tractor", "bicycle", "motorcycle", "train", "airplane", "helicopter", "ship", "fire-engine", "ambulance"]),
  ],
  orta: [
    basket("Mevalar", "apple", ["apple", "pear", "banana", "grapes", "tangerine", "lemon", "strawberry", "cherries", "watermelon", "peach", "pineapple", "kiwi"]),
    basket("Sabzavotlar", "carrot", ["carrot", "tomato", "cucumber", "potato", "onion", "garlic", "eggplant", "bell-pepper", "hot-pepper", "corn", "broccoli"]),
  ],
  qiyin: [basket("Uy hayvonlari", "cow", ["cow", ...HOME_ANIMALS]), basket("Yovvoyi hayvonlar", "lion", WILD_ANIMALS)],
};

export function sortBaskets(level: LevelId): [Basket, Basket] {
  return SORT_BASKETS[level];
}

export type SortRound = { item: GameItem; side: 0 | 1 };

/** Ikkala savatchaga teng bo'linadi, rasmlar takrorlanmaydi */
export function buildSortRounds(level: LevelId, count: number): SortRound[] {
  const [left, right] = SORT_BASKETS[level];
  const half = Math.ceil(count / 2);
  const sides = shuffle(Array.from({ length: count }, (_, i): 0 | 1 => (i < half ? 0 : 1)));
  const picks: [GameItem[], GameItem[]] = [shuffle(left.items), shuffle(right.items)];
  const taken = [0, 0];
  return sides.map((side) => ({ item: picks[side][taken[side]++ % picks[side].length], side }));
}

/* ------------------------------------------------------------------------ */
/* 6. Nechta?                                                                */
/* ------------------------------------------------------------------------ */

/** Sanaladigan narsalar — savolda nomi bilan: «Olma nechta?» */
const COUNT_ITEMS = items(["apple", "fish", "star", "balloon", "chick", "car", "tulip", "ladybug", "strawberry", "butterfly"]);

/** Daraja → nechtagacha sanaladi */
const COUNT_RANGE: Record<LevelId, [number, number]> = { oson: [1, 5], orta: [4, 8], qiyin: [6, 10] };

export type CountRound = {
  item: GameItem;
  count: number;
  options: number[];
  /** Rasmlar joyi: 5×3 katakdan qaysilari (tartibsiz uyumdek ko'rinsin) */
  cells: number[];
};

export function buildCountRounds(level: LevelId, count: number): CountRound[] {
  const [lo, hi] = COUNT_RANGE[level];
  const chosen = shuffle(COUNT_ITEMS);
  let previous = 0;
  return Array.from({ length: count }, (_, i) => {
    let answer = previous;
    while (answer === previous) answer = lo + Math.floor(Math.random() * (hi - lo + 1));
    previous = answer;
    // Chalg'ituvchilar — yonidagi sonlar (±1, ±2): bola aniq sanashi kerak.
    // Chetda (1 yoki 10) yetmasa — ±3, ±4 dan to'ldiriladi
    const near = [...shuffle([answer - 2, answer - 1, answer + 1, answer + 2]), answer - 3, answer + 3, answer - 4, answer + 4].filter(
      (n) => n >= 1 && n <= 10,
    );
    return {
      item: chosen[i % chosen.length],
      count: answer,
      options: shuffle([answer, ...near.slice(0, level === "qiyin" ? 3 : 2)]),
      cells: shuffle(Array.from({ length: 15 }, (_, cell) => cell)).slice(0, answer),
    };
  });
}

/* ------------------------------------------------------------------------ */
/* 7. Qaysi harf?                                                            */
/* ------------------------------------------------------------------------ */

/**
 * So'zlar: [bosh harf, so'z, rasm]. So'z o'zbekcha qoladi (o'yin o'zbek
 * alifbosini o'rgatadi), rasm — mavzulardagi 3D rasm. Apostrof saytdagi
 * kabi oddiy «'» (O', G').
 */
type LetterWord = readonly [letter: string, word: string, image: string];

const EASY_WORDS: LetterWord[] = [
  ["O", "Olma", "apple"], ["O", "Oy", "moon"],
  ["A", "Ayiq", "bear"], ["A", "Ari", "bee"], ["A", "Ananas", "pineapple"],
  ["B", "Banan", "banana"], ["B", "Baliq", "fish"], ["B", "Bulut", "cloud"],
  ["M", "Mushuk", "cat"], ["M", "Mashina", "car"], ["M", "Maymun", "monkey"],
  ["S", "Sabzi", "carrot"], ["S", "Sut", "milk"], ["S", "Sigir", "cow"],
  ["T", "Tarvuz", "watermelon"], ["T", "Tuxum", "egg"], ["T", "Tulki", "fox"],
  ["K", "Kema", "ship"], ["K", "Kitob", "books"], ["K", "Kalit", "key"],
  ["U", "Uzum", "grapes"],
  ["N", "Non", "bread"], ["N", "Nok", "pear"],
  ["L", "Limon", "lemon"], ["L", "Lola", "tulip"],
];

const MID_WORDS: LetterWord[] = [
  ...EASY_WORDS,
  ["F", "Fil", "elephant"],
  ["Y", "Yulduz", "star"],
  ["D", "Daraxt", "tree"], ["D", "Delfin", "dolphin"],
  ["P", "Pingvin", "penguin"], ["P", "Pomidor", "tomato"],
  ["R", "Raketa", "rocket"], ["R", "Robot", "robot"],
  ["Z", "Zebra", "zebra"],
  ["J", "Jirafa", "giraffe"],
  ["E", "Echki", "goat"], ["E", "Eshak", "donkey"],
  ["G", "Gul", "rose"],
  ["V", "Velosiped", "bicycle"],
  ["Q", "Quyon", "rabbit"], ["Q", "Qalam", "pencil"],
];

/** Qiyin: o'zbek tiliga xos va bir-biriga o'xshash harflar */
const HARD_WORDS: LetterWord[] = [
  ["Sh", "Sher", "lion"], ["Sh", "Shar", "balloon"], ["Sh", "Shaftoli", "peach"],
  ["Ch", "Chumoli", "ant"], ["Ch", "Chivin", "mosquito"],
  ["O'", "O'rdak", "duck"], ["O'", "O'rgimchak", "spider"],
  ["G'", "G'oz", "goose"],
  ["Q", "Quyosh", "sun"], ["Q", "Qulupnay", "strawberry"],
  ["X", "Xo'roz", "rooster"],
];

const EASY_LETTERS = ["O", "A", "B", "M", "S", "T", "K", "U", "N", "L"];
const MID_LETTERS = [...new Set(MID_WORDS.map(([letter]) => letter))];

/** Qiyin darajada chalg'ituvchi — aynan adashtiradigan harflar */
const CONFUSING_LETTERS: Record<string, string[]> = {
  Sh: ["S", "Ch", "O'"],
  Ch: ["Sh", "S", "X"],
  "O'": ["O", "U", "G'"],
  "G'": ["G", "Q", "O'"],
  Q: ["K", "G", "G'"],
  X: ["H", "K", "Sh"],
};

export type LetterRound = {
  letter: string;
  word: string;
  /** Harfdan keyingi qismi: «Olma» → «lma» */
  rest: string;
  item: GameItem;
  options: string[];
};

export function buildLetterRounds(level: LevelId, count: number): LetterRound[] {
  const pool = shuffle(level === "oson" ? EASY_WORDS : level === "orta" ? MID_WORDS : HARD_WORDS);
  // Iloji boricha har savolda boshqa harf
  const chosen: LetterWord[] = [];
  const letters = new Set<string>();
  for (const entry of pool) {
    if (chosen.length < count && !letters.has(entry[0])) {
      chosen.push(entry);
      letters.add(entry[0]);
    }
  }
  for (const entry of pool) if (chosen.length < count && !chosen.includes(entry)) chosen.push(entry);

  return chosen.map(([letter, word, image]) => {
    const others =
      level === "qiyin"
        ? shuffle(CONFUSING_LETTERS[letter]).slice(0, 3)
        : shuffle((level === "oson" ? EASY_LETTERS : MID_LETTERS).filter((other) => other !== letter)).slice(0, 2);
    return { letter, word, rest: word.slice(letter.length), item: item(image), options: shuffle([letter, ...others]) };
  });
}
