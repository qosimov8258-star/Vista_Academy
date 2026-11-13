"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import { isParentEntrySession } from "@/lib/parent-entry";

/** API dagi PARENT_PAGES bilan bir xil */
const PAGES = new Set(["kundalik", "jadval", "fayllar", "tolov", "dokon", "foydali", "xabarlar", "sozlamalar", "tanlash"]);
const PING_MS = 30_000;

function pageOf(pathname: string, slug: string): string | null {
  const base = `/ota-ona/${slug}`;
  if (!pathname.startsWith(base)) return null;
  const segment = pathname.slice(base.length).split("/").filter(Boolean)[0] ?? "";
  if (!segment) return "home";
  return PAGES.has(segment) ? segment : null;
}

function selectedChild(slug: string): string | undefined {
  try {
    return window.localStorage.getItem(`parent-child:${slug}`) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Ping — sahifa yopilayotganda ham yetib borsin (keepalive), xatosi e'tiborsiz */
function ping(id: string, resume = false) {
  void fetch(`${PARENT_API_URL}/app/parent/activity/views/${id}/ping`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resume ? { resume: true } : {}),
  }).catch(() => undefined);
}

/**
 * Kabinet faolligi — bog'cha panelining «Ota-onalar» bo'limi uchun: qaysi
 * bo'lim ochilgani va unda qancha vaqt o'tkazilgani. Har bo'lim ochilganda
 * bitta yozuv; ekranda ko'rinib turganda har 30 soniyada «ping» (vaqtni
 * server hisoblaydi), yashirilganda/yopilganda oxirgi ping. Hech narsa
 * ko'rsatmaydi va ota-onaning ishiga xalaqit bermaydi — xatolar jimgina o'tadi.
 */
export function ActivityTracker({ slug }: { slug: string }) {
  const pathname = usePathname();
  const page = pageOf(pathname, slug);

  useEffect(() => {
    // Bog'cha xodimi «Ota-ona profiliga kirish» bilan ochgan tab — statistikaga yozilmaydi
    if (!page || isParentEntrySession()) return;
    let id: string | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (id && document.visibilityState === "visible") ping(id);
      }, PING_MS);
    };
    const onVisibility = () => {
      if (!id) return;
      if (document.visibilityState === "hidden") {
        ping(id);
      } else {
        // Qaytdi: yashirin turgan vaqt qo'shilmasin — hisob shu yerdan qayta boshlanadi
        ping(id, true);
        startTimer();
      }
    };

    parentApi
      .post<{ id: string }>("/app/parent/activity/views", { page, childId: selectedChild(slug) })
      .then((res) => {
        if (cancelled) {
          ping(res.id);
          return;
        }
        id = res.id;
        startTimer();
      })
      .catch(() => undefined);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      if (id) ping(id);
    };
  }, [page, slug]);

  return null;
}
