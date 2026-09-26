"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Mobilda yuqori paneldagi (uch chiziq qatoridagi) bo'sh joyga sahifaga xos
 * tugmani chiqaradi (masalan "Eksport"). Faqat <768px da ko'rinadi — kompyuterda
 * tugma sahifaning o'z joyida turadi (qarang: Topbar'dagi #topbar-actions).
 */
export function TopbarAction({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById("topbar-actions"));
  }, []);
  return slot ? createPortal(children, slot) : null;
}
