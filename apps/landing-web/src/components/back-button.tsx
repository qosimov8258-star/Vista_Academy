"use client";

import { useRouter } from "next/navigation";

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12.5 4.5 6 10l6.5 5.5" />
    </svg>
  );
}

/**
 * Ekranning pastki qismida, barmoq bilan qulay yetadigan joyda turadigan
 * "Orqaga" tugmasi — to'liq ekranli sahifalarda (masalan, ariza formasi)
 * yuqoridagi navigatsiyaga qo'l cho'zib, xato bosib yubormaslik uchun.
 */
export function BackButton() {
  const router = useRouter();

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-center px-6"
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-6 py-3.5 text-[14px] font-bold text-[var(--color-text)] shadow-[var(--shadow-raised)] transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Orqaga
      </button>
    </div>
  );
}
