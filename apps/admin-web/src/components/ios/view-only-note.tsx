"use client";

import { Info } from "lucide-react";
import type { TenantUserRole } from "@/lib/types";
import { IosIcon } from "@/features/director/ios-icon";
import { GROUP_BLOCK } from "./tokens";
import { useTr } from "@/i18n/tr";

/**
 * "Faqat ko'rish rejimi" — iOS uslubida (`components/ui/view-only-note`
 * bilan bir xil matn). Yozish tugmalari yashirilganda sababini rolga qarab
 * tushuntiradi.
 */
export function ViewOnlyNote({ role }: { role?: TenantUserRole }) {
  const tr = useTr();
  const message =
    role === "FINANCE"
      ? "Moliyachi Moliya va Ish haqi bo'limlarida o'zgartirish kiritadi."
      : role === "TEACHER"
        ? "O'qituvchi o'z guruhlarining davomatini yuritadi va bola suratini qo'yadi."
        : role === "CHEF"
          ? "Oshpaz faqat oshxona bo'limlarida ishlaydi."
          : "Yozish va qo'shish filial darajasidagi foydalanuvchilar uchun.";
  return (
    <div className={`${GROUP_BLOCK} flex items-start gap-3 px-4 py-3`}>
      <IosIcon icon={Info} tint="blue" size={30} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Faqat ko'rish rejimi")}</p>
        <p className="text-[13px] leading-snug text-[#8e8e93]">{tr(message)}</p>
      </div>
    </div>
  );
}
