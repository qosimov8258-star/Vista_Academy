"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "vista-intro-seen";
// Animatsiya juda sekin yuklansa yoki xabar yetib kelmasa ham sayt abadiy
// to'silib qolmasin uchun zaxira vaqt (animatsiyaning o'z ichidagi finishIntro
// chaqiruvlaridan ancha uzoqroq).
const FALLBACK_MS = 25000;

export function BusIntro() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {}
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const finish = () => {
      setClosing(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {}
      setTimeout(() => setVisible(false), 500);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "vista-intro-done") finish();
    };

    window.addEventListener("message", handleMessage);
    const fallback = setTimeout(finish, FALLBACK_MS);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(fallback);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#fffdf7] transition-opacity duration-500"
      style={{ opacity: closing ? 0 : 1, pointerEvents: closing ? "none" : "auto" }}
    >
      <iframe
        src="/animatsiya/vista-academy-avtobus.html"
        title="Vista Academy — Sehrli avtobus"
        className="h-full w-full border-0"
        allow="autoplay"
      />
    </div>
  );
}
