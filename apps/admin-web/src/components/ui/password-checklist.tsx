import clsx from "clsx";
import { CheckIcon } from "@/components/ui/icons";
import { useTr } from "@/i18n/tr";

export interface PasswordRule {
  label: string;
  met: boolean;
}

/** Parol/login talablarini hisoblaydi — checklist ham, validatsiya ham shundan foydalanadi. */
export function getPasswordRules(password: string, confirmPassword?: string): PasswordRule[] {
  const rules: PasswordRule[] = [
    { label: "Kamida 8 ta belgidan iborat bo'lishi kerak", met: password.length >= 8 },
  ];
  if (confirmPassword !== undefined) {
    rules.push({ label: "Parollar mos keladi", met: password.length > 0 && password === confirmPassword });
  }
  return rules;
}

/** Har bir talab parol kiritilayotganda birma-bir yashildan ko'kka o'tadi. */
export function PasswordChecklist({ rules }: { rules: PasswordRule[] }) {
  const tr = useTr();
  return (
    <ul className="space-y-1.5">
      {rules.map((rule) => (
        <li key={rule.label} className="flex items-center gap-2 text-[12.5px]">
          <span
            className={clsx(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
              rule.met ? "bg-[var(--color-success)] text-white" : "bg-[var(--color-border)] text-[var(--color-text-muted)]",
            )}
          >
            <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          <span className={clsx("transition-colors duration-200", rule.met ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]")}>
            {tr(rule.label)}
          </span>
        </li>
      ))}
    </ul>
  );
}
