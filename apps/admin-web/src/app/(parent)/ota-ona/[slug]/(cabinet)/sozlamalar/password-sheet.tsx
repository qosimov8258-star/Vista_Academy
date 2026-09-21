"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import { CheckIcon, EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";

/** API bilan bir xil: `ChangeParentPasswordDto.newPassword` — kamida 6 belgi */
const MIN_LENGTH = 6;

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
  invalid,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder: string;
  hint?: string | null;
  invalid?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();

  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold text-[var(--p-ink)]">{label}</span>
      <span className="relative block">
        <input
          ref={inputRef}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? hintId : undefined}
          className={`h-14 w-full rounded-[18px] border-2 bg-[var(--p-sunken)] pl-4 pr-14 text-[17px] text-[var(--p-ink)] outline-none transition-colors placeholder:text-[var(--p-muted)]/60 focus:border-[var(--p-sun)] ${
            invalid ? "border-[var(--p-coral)]" : "border-transparent"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Parolni yashirish" : "Parolni ko'rsatish"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[var(--p-muted)] transition-colors active:bg-[var(--p-sunken)]"
        >
          {visible ? <EyeOffIcon className="h-[22px] w-[22px]" /> : <EyeIcon className="h-[22px] w-[22px]" />}
        </button>
      </span>
      {hint && (
        <span
          id={hintId}
          className={`mt-1.5 block text-[12.5px] ${invalid ? "font-medium text-[var(--p-coral)]" : "text-[var(--p-muted)]"}`}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

/**
 * Parolni almashtirish oynasi (pastdan chiqadi). API parol almashganda
 * barcha seanslarni yopadi — shu telefondagisini ham. Ota-ona kabinetdan
 * chiqib ketmasligi uchun yangi parol bilan darhol qayta kiramiz; ikkinchi
 * ota-onaning telefonida esa yangi parol so'raladi.
 */
export function PasswordSheet({
  slug,
  phone,
  onClose,
  onSignedOut,
}: {
  slug: string;
  phone: string;
  onClose: () => void;
  /** Qayta kirib bo'lmasa — kirish sahifasiga */
  onSignedOut: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, busy]);

  useEffect(() => {
    // Oyna chiqib bo'lgach fokus — aks holda telefon klaviaturasi animatsiyani bo'ladi
    const timer = window.setTimeout(() => firstRef.current?.focus({ preventScroll: true }), 280);
    return () => window.clearTimeout(timer);
  }, []);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const sameAsCurrent = next.length > 0 && next === current;
  const mismatch = repeat.length > 0 && repeat !== next;
  const ready = current.length > 0 && next.length >= MIN_LENGTH && repeat === next && !sameAsCurrent;

  const edit = (setter: (value: string) => void) => (value: string) => {
    if (error) setError(null);
    setter(value);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await parentApi.post("/app/parent/password", { currentPassword: current, newPassword: next });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.");
      setBusy(false);
      return;
    }
    try {
      await parentApi.post("/app/parent/login", { orgSlug: slug, phone, password: next });
    } catch {
      onSignedOut();
      return;
    }
    setBusy(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Parolni almashtirish">
      <button
        type="button"
        aria-label="Yopish"
        onClick={() => !busy && onClose()}
        className={`${styles.fadeIn} absolute inset-0 cursor-default bg-black/45`}
      />
      <div
        className={`${styles.sheetIn} relative max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[30px] bg-[var(--p-card)] px-5 pt-3 shadow-[var(--p-shadow)]`}
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <span aria-hidden="true" className="mx-auto block h-1.5 w-10 rounded-full bg-[var(--p-muted)]/30" />

        {done ? (
          <div className="flex flex-col items-center pb-2 pt-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--p-mint)]/16 text-[var(--p-mint)]">
              <CheckIcon className="h-8 w-8" />
            </span>
            <p className={`${styles.roundedFont} mt-4 text-[21px] font-extrabold text-[var(--p-ink)]`}>Parol almashtirildi</p>
            <p className="mt-1.5 max-w-[340px] text-[14px] leading-relaxed text-[var(--p-muted)]">
              Endi yangi parol bilan kirasiz. Ikkinchi ota-onaga ham yangi parolni ayting — uning telefonida kabinet qayta kirishni so&apos;raydi.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 flex h-14 w-full cursor-pointer items-center justify-center rounded-full bg-[var(--p-coral)] text-[16px] font-extrabold text-white transition-transform active:scale-[0.98]"
            >
              Yaxshi
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className={`${styles.roundedFont} mt-3 text-[20px] font-extrabold text-[var(--p-ink)]`}>Parolni almashtirish</p>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--p-muted)]">
              Ota va ona bitta kabinetdan foydalanadi — yangi parolni ikkalangiz bilishingiz kerak.
            </p>

            {/* Parol menejeri yangi parolni qaysi login uchun saqlashni bilsin */}
            <input type="text" name="username" autoComplete="username" value={phone} readOnly hidden />

            <div className="mt-4 space-y-3.5">
              <PasswordField
                inputRef={firstRef}
                label="Hozirgi parol"
                placeholder="Hozir kirayotgan parolingiz"
                autoComplete="current-password"
                value={current}
                onChange={edit(setCurrent)}
                invalid={touched && current.length === 0}
                hint={touched && current.length === 0 ? "Hozirgi parolni kiriting" : null}
              />
              <PasswordField
                label="Yangi parol"
                placeholder="Kamida 6 ta belgi"
                autoComplete="new-password"
                value={next}
                onChange={edit(setNext)}
                invalid={tooShort || sameAsCurrent || (touched && next.length === 0)}
                hint={
                  sameAsCurrent
                    ? "Yangi parol hozirgisidan farq qilishi kerak"
                    : tooShort
                      ? `Yana ${MIN_LENGTH - next.length} ta belgi kerak`
                      : touched && next.length === 0
                        ? "Yangi parolni kiriting"
                        : null
                }
              />
              <PasswordField
                label="Yangi parolni takrorlang"
                placeholder="Xuddi shu parol"
                autoComplete="new-password"
                value={repeat}
                onChange={edit(setRepeat)}
                invalid={mismatch || (touched && repeat.length === 0)}
                hint={
                  mismatch
                    ? "Parollar bir xil emas"
                    : repeat.length > 0 && repeat === next && next.length >= MIN_LENGTH
                      ? "Parollar mos keldi"
                      : touched && repeat.length === 0
                        ? "Yangi parolni qayta kiriting"
                        : null
                }
              />
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded-[16px] bg-[var(--p-coral)]/12 px-4 py-3 text-[14px] font-medium text-[var(--p-coral)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--p-coral)] text-[16px] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(255,122,102,0.9)] transition-[transform,opacity] active:scale-[0.98] disabled:opacity-70"
              style={{ opacity: ready || busy ? undefined : 0.55 }}
            >
              {busy && <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {busy ? "Almashtirilmoqda…" : "Parolni almashtirish"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="mt-1.5 w-full cursor-pointer rounded-full py-3 text-[15px] font-bold text-[var(--p-muted)] transition-colors active:bg-[var(--p-sunken)] disabled:opacity-50"
            >
              Bekor qilish
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
