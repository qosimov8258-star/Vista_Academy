import type { TenantUserRole } from "@/lib/types";

/**
 * Yozish tugmalari yashirilganda sababini tushuntiradi. Sabab rolga qarab
 * turlicha: Super Admin butun tarmoqni kuzatadi, moliyachi esa faqat shu
 * bo'limda cheklangan — shuning uchun matn ham bir xil bo'lmasligi kerak.
 */
export function ViewOnlyNote({ role }: { role?: TenantUserRole }) {
  const message =
    role === "FINANCE"
      ? "Bu bo'limni faqat ko'rmoqdasiz — moliyachi Moliya va Ish haqi bo'limlarida o'zgartirish kiritadi."
      : role === "TEACHER"
        ? "Bu bo'limni faqat ko'rmoqdasiz — o'qituvchi o'z guruhlarining davomati va kundalik hisobotini yuritadi."
        : "Siz kuzatuvchi sifatida ko'rmoqdasiz — yozish/qo'shish filial darajasidagi foydalanuvchilar uchun.";

  return (
    <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
      {message}
    </div>
  );
}
