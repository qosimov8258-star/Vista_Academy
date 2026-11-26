"use client";

import clsx from "clsx";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isWinterSeason } from "@/lib/winter";
import { Snowfall } from "./snowfall";

/**
 * Xodimlar paneli qobig'i — mavsumni biladi. Qishda (20-noyabr — fevral)
 * `data-season="winter"` qo'yadi: fon «Tong shafag'i» bo'ladi, kartalar
 * ustida qor qatlami, pastki panelda qirov chiqadi (winter.css) va butun
 * panel ustida qor yog'adi. Boshqa paytda oddiy `div`.
 *
 * Mavsum faqat brauzerda aniqlanadi (Toshkent vaqti bilan) — serverda va
 * birinchi chizishda qishsiz, keyin bir zumda qishga o'tadi.
 */

const WinterContext = createContext(false);

/** Hozir qishmi — rangli bosh kartaga qishki manzara qo'shish uchun */
export const useWinter = () => useContext(WinterContext);

/** Qor qo'nadigan joylar — sahifa mazmunidagi kartalar */
const STAFF_SNOW_SURFACES = '[data-season="winter"] main .ios-snow';

export function SeasonShell({ className, children }: { className: string; children: ReactNode }) {
  const [winter, setWinter] = useState(false);

  useEffect(() => {
    setWinter(isWinterSeason());
  }, []);

  return (
    <WinterContext.Provider value={winter}>
      <div className={clsx("staff-shell", className)} data-season={winter ? "winter" : undefined}>
        {children}
        {winter && <Snowfall dark={false} className="winter-snowfall" surfaces={STAFF_SNOW_SURFACES} />}
      </div>
    </WinterContext.Provider>
  );
}
