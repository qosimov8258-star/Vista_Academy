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
 * shu holatni ko'rsatadi; `?oyfaza=0.25` — oy fazasini (0 yangi, 0.5 to'lin).
 */
export function useSky(...locationTexts: Array<string | null | undefined>): SkyState | null {
  const [sky, setSky] = useState<SkyState | null>(null);
  const locationKey = locationTexts.filter(Boolean).join("|");

  useEffect(() => {
    const coords = resolveCoords(...locationKey.split("|"));
    const params = new URLSearchParams(window.location.search);
    const preview = params.get("osmon");
    const forced = PREVIEW_PHASES.find((phase) => phase === preview) ?? null;
    const moonParam = params.get("oyfaza");
    const forcedMoon = moonParam !== null && Number.isFinite(Number(moonParam)) ? ((Number(moonParam) % 1) + 1) % 1 : null;

    let timer = 0;
    const tick = () => {
      const state = computeSky(Date.now(), coords);
      setSky({ ...state, phase: forced ?? state.phase, moonPhase: forcedMoon ?? state.moonPhase });
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
