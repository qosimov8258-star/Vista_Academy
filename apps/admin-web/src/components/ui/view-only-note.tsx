import type { TenantUserRole } from "@/lib/types";
import { InfoIcon } from "./icons";

/**
 * Yozish tugmalari yashirilganda sababini tushuntiradi. Sabab rolga qarab
 * turlicha: Super Admin butun tarmoqni kuzatadi, moliyachi esa faqat shu
 * bo'limda cheklangan — shuning uchun matn ham bir xil bo'lmasligi kerak.
 */
export function ViewOnlyNote({ role }: { role?: TenantUserRole }) {
  const message =
    role === "FINANCE"
      ? "Moliyachi Moliya va Ish haqi bo'limlarida o'zgartirish kiritadi."
      : role === "TEACHER"
        ? "O'qituvchi o'z guruhlarining davomati va kundalik hisobotini yuritadi."
        : "Yozish va qo'shish filial darajasidagi foydalanuvchilar uchun.";

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-primary)]/[0.06] px-4 py-3.5">
      <InfoIcon className="mt-px h-5 w-5 shrink-0 text-[var(--color-primary)]" />
      <div>
        <p className="text-[14px] font-semibold text-[var(--color-text)]">Faqat ko&apos;rish rejimi</p>
        <p className="text-[14px] text-[var(--color-text-muted)]">{message}</p>
      </div>
    </div>
  );
}
