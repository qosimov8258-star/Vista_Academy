"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";
import type { SkyState } from "@/lib/sky";
import { useSky } from "./use-sky";
import { isWinterSeason } from "@/lib/winter";
import { Snowfall } from "@/components/winter/snowfall";
import styles from "../parent.module.css";

/**
 * Kabinet ko'rinishi: yorug' yoki qorong'i.
 *
 * Sukut bo'yicha yorug' (oq fonli iOS ko'rinishi). Ota-ona Sozlamalarda
 * «Avto»ni tanlasa — osmon holatiga ergashadi (qarang: use-sky.ts): quyosh
 * botganda qorong'i ko'rinish o'zi yonadi, tongda o'chadi; yoki doimiy
 * qorong'i qilib qo'yishi mumkin.
 * Tanlov telefonning o'zida (localStorage) saqlanadi — kabinet bitta, lekin
 * ota bilan ona har biri o'z telefonida o'ziga qulayini tanlaydi.
 *
 * Qorong'i rejim `.shell` ga `data-theme="dark"` orqali qo'llanadi: ranglar
 * CSS o'zgaruvchilarda (parent.module.css), sahifalar faqat ularni ishlatadi.
 */

export type ThemeMode = "avto" | "yorug" | "qorongi";

/**
 * Kalitlar `_v2`: iOS uslubiga o'tishda sukut «avto»dan «yorug'»ga o'zgardi
 * (egasining qarori — kabinet oq fonda ko'rinsin). Eski kalitdagi tanlov
 * o'qilmaydi: hamma yorug'dan boshlaydi, xohlagan Sozlamalarda o'zgartiradi.
 */
const MODE_KEY = "bogcha_parent_theme_v2";
/** Oxirgi qo'llangan ko'rinish — sahifa yuklanishida chaqnash bo'lmasligi uchun */
const EFFECTIVE_KEY = "bogcha_parent_theme_effective_v2";
const MODES: ThemeMode[] = ["avto", "yorug", "qorongi"];

interface CabinetTheme {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Hozir qorong'i ko'rinish qo'llanganmi */
  dark: boolean;
  /** Osmon holati — karta va sozlamalar uchun */
  sky: SkyState | null;
  /** Qishki bezak davri (20-noyabr — fevral oxiri): qor, qishki fon va ranglar */
  winter: boolean;
}

const ThemeContext = createContext<CabinetTheme>({ mode: "yorug", setMode: () => undefined, dark: false, sky: null, winter: false });

export const useCabinetTheme = () => useContext(ThemeContext);

/** Qor qo'nadigan joylar — qor qatlamli kartalar va plitkalar */
const PARENT_SNOW_SURFACES = '[data-season="winter"] [class*="snowCap"]';

function readMode(): ThemeMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    return MODES.find((mode) => mode === value) ?? "yorug";
  } catch {
    return "yorug";
  }
}

function readCachedDark(): boolean {
  try {
    return localStorage.getItem(EFFECTIVE_KEY) === "dark";
  } catch {
    return false;
  }
}

/**
 * Gidratsiyadan oldin ishlaydi: kecha qorong'i bo'lgan bo'lsa, sahifa avval
 * oq bo'lib chaqnab, keyin qorayib ketmasin. Qobiqda `suppressHydrationWarning`
 * bor — React shu atributni gidratsiyada nomuvofiq deb hisoblamaydi.
 */
const BOOT_SCRIPT = `try{if(localStorage.getItem("${EFFECTIVE_KEY}")==="dark")document.currentScript.parentElement.setAttribute("data-theme","dark")}catch(e){}`;

const noopSubscribe = () => () => undefined;

/**
 * Faqat server chizgan sahifada (va uning gidratsiyasida) true. Mijoz o'zi
 * qurgan sahifada (masalan, kirishdan keyingi o'tishda) false — u yerda
 * skript baribir ishlamas edi, React esa bunga ogohlantirish beradi.
 */
function useIsServerRendered(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => false,
    () => true,
  );
}

export function CabinetThemeProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("yorug");
  const [mounted, setMounted] = useState(false);
  const [cachedDark, setCachedDark] = useState(false);
  const [winter, setWinter] = useState(false);
  const serverRendered = useIsServerRendered();

  useEffect(() => {
    setModeState(readMode());
    setCachedDark(readCachedDark());
    // Sana qurilmada aniqlanadi — server bilan nomuvofiqlik bo'lmasin
    setWinter(isWinterSeason());
    setMounted(true);
  }, []);

  // Sahifalar bilan bir xil kalit — qo'shimcha so'rov ketmaydi
  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  const firstChild = meQuery.data?.children[0];
  const sky = useSky(firstChild?.branch.address, firstChild?.branch.name);

  const dark = mode === "qorongi" ? true : mode === "yorug" ? false : sky ? sky.phase === "tun" : cachedDark;

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(EFFECTIVE_KEY, dark ? "dark" : "light");
    } catch {
      // Saqlanmasa ham ishlayveradi — faqat keyingi yuklanishda chaqnashi mumkin
    }
  }, [dark, mounted]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // yuqoridagi kabi
    }
  }, []);

  const value = useMemo<CabinetTheme>(() => ({ mode, setMode, dark, sky, winter }), [mode, setMode, dark, sky, winter]);

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={`${styles.shell} min-h-[100dvh]`}
        data-theme={mounted ? (dark ? "dark" : "light") : undefined}
        data-season={winter ? "winter" : undefined}
        suppressHydrationWarning
      >
        {serverRendered && <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />}
        {children}
        {/* Qishda: qor yog'adi (bosilmaydi, menyu va oynalardan pastda) */}
        {winter && <Snowfall dark={dark} className={styles.snowfall} surfaces={PARENT_SNOW_SURFACES} />}
      </div>
    </ThemeContext.Provider>
  );
}
