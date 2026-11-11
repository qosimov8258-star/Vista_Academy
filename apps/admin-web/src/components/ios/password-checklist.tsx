"use client";

import clsx from "clsx";
import { CheckIcon } from "./icons";
import { IOS } from "./tokens";
import { useTr } from "@/i18n/tr";

// Talablar hisobi bitta joyda qoladi — validatsiya ham shundan foydalanadi
export { getPasswordRules, type PasswordRule } from "@/components/ui/password-checklist";

/** Parol talablari — iOS uslubida: bajarilgani yashil ✓, qolgani kulrang */
export function PasswordChecklist({ rules }: { rules: { label: string; met: boolean }[] }) {
  const tr = useTr();
  return (
    <ul className="space-y-1.5">
      {rules.map((rule) => (
        <li key={rule.label} className="flex items-center gap-2 text-[13px]">
          <span
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-white transition-colors"
            style={{ background: rule.met ? IOS.green : "rgba(118,118,128,0.24)" }}
          >
            <CheckIcon className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className={clsx("transition-colors")} style={{ color: rule.met ? IOS.green : IOS.gray }}>
            {tr(rule.label)}
          </span>
        </li>
      ))}
    </ul>
  );
}
