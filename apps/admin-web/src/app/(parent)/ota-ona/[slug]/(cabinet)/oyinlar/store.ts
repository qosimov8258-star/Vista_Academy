"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { LevelId } from "./data";

/**
 * O'yin natijalari va sozlamalari faqat shu qurilmada (localStorage) saqlanadi.
 * Serverga hech narsa ketmaydi — bola haqida ma'lumot to'planmaydi.
 * Saqlab bo'lmasa (yashirin oyna, to'lgan xotira) o'yin baribir ishlaydi.
 */

const KEY = "zeeron:oyinlar:v1";

type Result = { best: 0 | 1 | 2 | 3; plays: number };
type State = {
  /** «Juftini top»: `${mavzu}:${daraja}` → natija */
  memory: Record<string, Result>;
  /** «Kim qichqirdi?»: daraja → natija */
  sounds: Record<string, Result>;
  /** «Ortiqchasini top»: daraja → natija */
  odd: Record<string, Result>;
  /** Mantiqiy o'yinlar («Nima keyin keladi?» va boshqalar): `${o'yin}:${daraja}` → natija */
  logic: Record<string, Result>;
  /** Mantiqiy o'yinlarda oxirgi tanlangan daraja: o'yin → daraja */
  logicLevels: Record<string, LevelId>;
  level: LevelId;
  soundLevel: LevelId;
  oddLevel: LevelId;
  sound: boolean;
};

const DEFAULT: State = {
  memory: {},
  sounds: {},
  odd: {},
  logic: {},
  logicLevels: {},
  level: "oson",
  soundLevel: "oson",
  oddLevel: "oson",
  sound: true,
};

let cache: State | null = null;
const listeners = new Set<() => void>();

function read(): State {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<State>) : {};
    cache = {
      ...DEFAULT,
      ...parsed,
      memory: { ...(parsed.memory ?? {}) },
      sounds: { ...(parsed.sounds ?? {}) },
      odd: { ...(parsed.odd ?? {}) },
      logic: { ...(parsed.logic ?? {}) },
      logicLevels: { ...(parsed.logicLevels ?? {}) },
    };
  } catch {
    cache = DEFAULT;
  }
  return cache;
}

function write(next: State) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Saqlanmadi — sahifa ochiq ekan, xotiradagi holat ishlaydi
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGamesStore() {
  const state = useSyncExternalStore(subscribe, read, () => DEFAULT);

  const setLevel = useCallback((level: LevelId) => write({ ...read(), level }), []);
  const setSound = useCallback((sound: boolean) => write({ ...read(), sound }), []);
  /** Yakunlangan o'yin: eng yaxshi natija saqlanadi, o'yinlar soni oshadi */
  const saveMemoryResult = useCallback((topic: string, level: LevelId, stars: 1 | 2 | 3) => {
    const current = read();
    const key = `${topic}:${level}`;
    const prev = current.memory[key] ?? { best: 0, plays: 0 };
    write({
      ...current,
      memory: { ...current.memory, [key]: { best: Math.max(prev.best, stars) as Result["best"], plays: prev.plays + 1 } },
    });
  }, []);

  const setSoundLevel = useCallback((soundLevel: LevelId) => write({ ...read(), soundLevel }), []);
  const saveSoundResult = useCallback((level: LevelId, stars: 1 | 2 | 3) => {
    const current = read();
    const prev = current.sounds[level] ?? { best: 0, plays: 0 };
    write({
      ...current,
      sounds: { ...current.sounds, [level]: { best: Math.max(prev.best, stars) as Result["best"], plays: prev.plays + 1 } },
    });
  }, []);

  const setOddLevel = useCallback((oddLevel: LevelId) => write({ ...read(), oddLevel }), []);
  const saveOddResult = useCallback((level: LevelId, stars: 1 | 2 | 3) => {
    const current = read();
    const prev = current.odd[level] ?? { best: 0, plays: 0 };
    write({
      ...current,
      odd: { ...current.odd, [level]: { best: Math.max(prev.best, stars) as Result["best"], plays: prev.plays + 1 } },
    });
  }, []);

  const setLogicLevel = useCallback((game: string, level: LevelId) => {
    const current = read();
    write({ ...current, logicLevels: { ...current.logicLevels, [game]: level } });
  }, []);
  const saveLogicResult = useCallback((game: string, level: LevelId, stars: 1 | 2 | 3) => {
    const current = read();
    const key = `${game}:${level}`;
    const prev = current.logic[key] ?? { best: 0, plays: 0 };
    write({
      ...current,
      logic: { ...current.logic, [key]: { best: Math.max(prev.best, stars) as Result["best"], plays: prev.plays + 1 } },
    });
  }, []);

  return {
    level: state.level,
    logicLevel: (game: string): LevelId => state.logicLevels[game] ?? "oson",
    logicResult: (game: string, level: LevelId): Result => state.logic[`${game}:${level}`] ?? { best: 0, plays: 0 },
    setLogicLevel,
    saveLogicResult,
    oddLevel: state.oddLevel,
    oddResult: (level: LevelId): Result => state.odd[level] ?? { best: 0, plays: 0 },
    setOddLevel,
    saveOddResult,
    soundLevel: state.soundLevel,
    soundResult: (level: LevelId): Result => state.sounds[level] ?? { best: 0, plays: 0 },
    setSoundLevel,
    saveSoundResult,
    sound: state.sound,
    memoryResult: (topic: string, level: LevelId): Result => state.memory[`${topic}:${level}`] ?? { best: 0, plays: 0 },
    setLevel,
    setSound,
    saveMemoryResult,
  };
}
