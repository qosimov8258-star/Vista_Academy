"use client";

import { useEffect, useState } from "react";
import { computeSky, resolveCoords, type SkyPhase, type SkyState } from "@/lib/sky";

const PREVIEW_PHASES: SkyPhase[] = ["kun", "shafaq", "tun"];

/**
 * Osmon holati — kun, shafaq yoki tun — haqiqiy quyosh vaqtiga qarab.
 *
 * Faqat brauzerda hisoblanadi (`useEffect`): server bilan mijozning soati
 * farq qilsa, birinchi chizilgan sahifa mos kelmay qolardi. Holat o'zgaradigan
 * daqiqada o'zi yangilanadi; ilova orqa fonda uzoq turib qaytsa ham darhol
 * qayta hisoblaydi.
 *
 * Ko'rib chiqish uchun: `?osmon=kun|shafaq|tun` — haqiqiy vaqtdan qat'i nazar
 * shu holatni ko'rsatadi (oy fazasi baribir haqiqiy).
 */
export function useSky(...locationTexts: Array<string | null | undefined>): SkyState | null {
  const [sky, setSky] = useState<SkyState | null>(null);
  const locationKey = locationTexts.filter(Boolean).join("|");

  useEffect(() => {
    const coords = resolveCoords(...locationKey.split("|"));
    const preview = new URLSearchParams(window.location.search).get("osmon");
    const forced = PREVIEW_PHASES.find((phase) => phase === preview) ?? null;

    let timer = 0;
    const tick = () => {
      const state = computeSky(Date.now(), coords);
      setSky(forced ? { ...state, phase: forced } : state);
      // Keyingi o'zgarishda uyg'onamiz; har holda soatda bir marta tekshiramiz
      const wait = Math.min(Math.max(state.nextChange - Date.now(), 1_000), 60 * 60_000);
      timer = window.setTimeout(tick, wait);
    };
    tick();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [locationKey]);

  return sky;
}
