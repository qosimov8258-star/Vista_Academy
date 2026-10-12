"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParentChild } from "@/lib/types";

const storageKey = (slug: string) => `parent-child:${slug}`;

function readStored(slug: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(slug));
  } catch {
    return null;
  }
}

function writeStored(slug: string, id: string) {
  try {
    window.localStorage.setItem(storageKey(slug), id);
  } catch {
    // Xotiraga yozib bo'lmasa tanlov shu sahifa uchungina amal qiladi
  }
}

/**
 * Kabinetda tanlangan farzand. Bitta bola bo'lsa — o'sha, avtomatik.
 * Ikki va undan ko'p bo'lsa — tanlov brauzerda saqlanadi (sahifa
 * yangilansa ham qoladi); tanlanmagan yoki eskirgan bo'lsa, "Farzandni
 * tanlang" sahifasiga yo'naltiriladi.
 *
 * `children` — `/app/parent/me` javobi; yuklanguncha `undefined` bering.
 */
export function useSelectedChild(slug: string, children: ParentChild[] | undefined) {
  const router = useRouter();
  const [stored, setStored] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setStored(readStored(slug));
  }, [slug]);

  const list = children ?? [];
  const child = list.length === 1 ? list[0] : (list.find((c) => c.id === stored) ?? null);
  const needsChoice = children !== undefined && stored !== undefined && list.length > 1 && !child;

  useEffect(() => {
    if (needsChoice) router.replace(`/ota-ona/${slug}/tanlash`);
  }, [needsChoice, router, slug]);

  const select = useCallback(
    (id: string) => {
      writeStored(slug, id);
      setStored(id);
    },
    [slug],
  );

  return { child, childId: child?.id ?? null, select, multiple: list.length > 1 };
}
