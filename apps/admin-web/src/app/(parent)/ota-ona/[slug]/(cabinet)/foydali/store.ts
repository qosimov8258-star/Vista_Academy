"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * "Foydali" bo'limining qurilmadagi holati: nimalar yodlandi va matn o'lchami.
 *
 * Telefonning o'zida saqlanadi (localStorage) — server kerak emas, ota bilan
 * ona har biri o'z telefonida belgilaydi. Keyinchalik tarbiyachi ham ko'rishi
 * kerak bo'lsa, shu yerda API'ga yuboriladi.
 *
 * `useSyncExternalStore`: serverda va gidratsiyada sukut qiymati, keyin
 * saqlangani — shu tufayli gidratsiya nomuvofiqligi bo'lmaydi.
 */
function createLocalStore<T>(key: string, fallback: T, parse: (raw: unknown) => T) {
  let cache: { value: T } | null = null;
  const listeners = new Set<() => void>();

  const get = (): T => {
    if (!cache) {
      let value = fallback;
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) value = parse(JSON.parse(raw));
      } catch {
        // Buzilgan yoki ruxsat yo'q — sukut qiymati
      }
      cache = { value };
    }
    return cache.value;
  };

  const set = (value: T) => {
    cache = { value };
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Saqlanmasa ham shu seans davomida ishlayveradi
    }
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    // Boshqa varaqda o'zgarsa, shu yerda ham yangilansin
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) {
        cache = null;
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const useValue = () => useSyncExternalStore(subscribe, get, () => fallback);
  return { useValue, get, set };
}

export type LearnedKind = "poems" | "proverbs" | "tales";
type Learned = Record<LearnedKind, string[]>;

const EMPTY_LEARNED: Learned = { poems: [], proverbs: [], tales: [] };
const ids = (value: unknown) => (Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []);

const learnedStore = createLocalStore<Learned>("bogcha_parent_learned", EMPTY_LEARNED, (raw) => {
  const record = (raw ?? {}) as Partial<Record<LearnedKind, unknown>>;
  return { poems: ids(record.poems), proverbs: ids(record.proverbs), tales: ids(record.tales) };
});

export function useLearned() {
  const learned = learnedStore.useValue();
  const has = useCallback((kind: LearnedKind, id: string) => learned[kind].includes(id), [learned]);
  /** Belgini almashtiradi va yangi holatni qaytaradi: true — endi yodlangan */
  const toggle = useCallback((kind: LearnedKind, id: string): boolean => {
    const current = learnedStore.get();
    const on = !current[kind].includes(id);
    learnedStore.set({ ...current, [kind]: on ? [...current[kind], id] : current[kind].filter((x) => x !== id) });
    return on;
  }, []);
  return { learned, has, toggle };
}

/** Faqat hozir mavjud bo'lganlarini sanaydi — o'chirilganlar hisobga kirmasin */
export function countLearned(learnedIds: string[], items: Array<{ id: string }>): number {
  return items.filter((item) => learnedIds.includes(item.id)).length;
}

/** Matn o'lchami: 0 — oddiy, 1 — katta (sukut), 2 — juda katta */
export type TextSize = 0 | 1 | 2;
const textSizeStore = createLocalStore<TextSize>("bogcha_parent_textsize", 1, (raw) =>
  raw === 0 || raw === 1 || raw === 2 ? raw : 1,
);
export const useTextSize = textSizeStore.useValue;
export const setTextSize = textSizeStore.set;

const noopSubscribe = () => () => undefined;

function localDayNumber(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
}

/**
 * Bugungi kun raqami — "Bugungi she'r/maqol" tanlash uchun. Faqat brauzerda
 * hisoblanadi (serverda 0): server bilan telefonning sanasi yarim tunda farq
 * qilsa, gidratsiya buzilmasin.
 */
export function useDayIndex(): number {
  return useSyncExternalStore(noopSubscribe, localDayNumber, () => 0);
}
