"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import styles from "../parent.module.css";
import { tabIndexOf } from "./tabs";

/**
 * Bo'limdan bo'limga silliq o'tish.
 *
 * `key` manzilga bog'langani uchun har o'tishda ichki qism qaytadan
 * o'rnatiladi va animatsiya boshidan ishlaydi. Yo'nalish menyu tartibidan
 * olinadi: o'ngdagi bo'limga o'tsak mazmun o'ngdan kiradi — telefonda bu
 * varaqlash hissini beradi, shunchaki "yonib o'chish" emas.
 */
export function ParentPageTransition({ slug, children }: { slug: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/ota-ona/${slug}`;
  const index = tabIndexOf(pathname, base);

  // Sinf manzil o'zgargandagina qayta hisoblanadi. Aks holda qobiqning har
  // qanday qayta chizilishi tugagan animatsiyani boshidan yugurtirib
  // yuborardi — ko'zga sahifa "sakragandek" ko'rinadi.
  const shown = useRef<{ path: string; index: number; className: string | undefined }>({
    path: pathname,
    index,
    // Ilk yuklashda o'tish yo'q: sahifaning o'z animatsiyalari bor.
    className: undefined,
  });
  if (shown.current.path !== pathname) {
    const from = shown.current.index;
    const known = index !== -1 && from !== -1 && index !== from;
    shown.current = {
      path: pathname,
      index,
      className: known ? (index > from ? styles.enterRight : styles.enterLeft) : styles.enterSoft,
    };
  }

  return (
    <div className={styles.pageWrap}>
      <div key={pathname} className={shown.current.className}>
        {children}
      </div>
    </div>
  );
}
