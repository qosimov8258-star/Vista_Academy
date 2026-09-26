"use client";

import { useState, type FormEvent } from "react";
import { submitLandingApplication } from "@/lib/api";
import { normalizeUzPhone } from "@/lib/phone";

interface FormValues {
  fullName: string;
  phone: string;
}

const PHONE_PREFIX = "+998";

const INITIAL_VALUES: FormValues = { fullName: "", phone: `${PHONE_PREFIX} ` };

/**
 * Kiritilgan matndan faqat raqamlarni ajratib oladi va "+998 XX XXX XX XX"
 * ko'rinishida guruhlab formatlaydi. Harflar va boshqa belgilar e'tiborga
 * olinmaydi, "+998" prefiksi esa doim saqlanib qoladi.
 */
function formatUzPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("998")) {
    digits = digits.slice(3);
  }
  digits = digits.slice(0, 9);

  const groups: string[] = [];
  if (digits.length > 0) groups.push(digits.slice(0, 2));
  if (digits.length > 2) groups.push(digits.slice(2, 5));
  if (digits.length > 5) groups.push(digits.slice(5, 7));
  if (digits.length > 7) groups.push(digits.slice(7, 9));

  return groups.length ? `${PHONE_PREFIX} ${groups.join(" ")}` : `${PHONE_PREFIX} `;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (values.fullName.trim().length < 2) {
    errors.fullName = "Ismingizni to'liq kiriting";
  }

  if (!normalizeUzPhone(values.phone)) {
    errors.phone = "Telefon raqami noto'g'ri. Namuna: +998 90 123 45 67";
  }

  return errors;
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="10" cy="6.5" r="3.2" />
      <path d="M3.5 17c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 3.5h3.2l1.3 3.8-2 1.6a10.5 10.5 0 0 0 4.6 4.6l1.6-2 3.8 1.3V16a1.5 1.5 0 0 1-1.5 1.5C8.6 17.5 2.5 11.4 2.5 5a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 10.3 3.3 3.3L15 6.5" />
    </svg>
  );
}

function fieldClass(hasError: boolean) {
  return `flex items-center gap-3 rounded-full border px-5 py-3.5 transition-colors ${
    hasError ? "border-red-300 bg-red-50/40" : "border-[var(--color-border)] bg-[var(--color-surface)] focus-within:border-[var(--color-green)]"
  }`;
}

export function ApplicationForm() {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    const result = await submitLandingApplication({
      fullName: values.fullName.trim(),
      phone: normalizeUzPhone(values.phone)!,
    });
    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center px-7 py-9 sm:px-9">
        {submitted ? (
          <div className="py-4 text-center">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "var(--color-tint-green)", color: "var(--color-green-dark)" }}
            >
              <CheckIcon className="h-8 w-8" />
            </div>
            <h2 className="font-heading mt-5 text-[22px] font-bold text-[var(--color-text)]">Tashakkur!</h2>
            <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
              Arizangiz qabul qilindi. Tez orada operatorlarimiz siz bilan bog&apos;lanishadi.
            </p>
            <a
              href="/"
              className="mt-6 inline-flex rounded-full px-6 py-3 text-[14px] font-bold text-white shadow-[var(--shadow-cta)] transition-transform duration-150 hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, var(--color-green) 0%, var(--color-green-dark) 100%)" }}
            >
              Bosh sahifaga qaytish
            </a>
          </div>
        ) : (
          <>
            <h1 className="font-heading text-[24px] font-bold text-[var(--color-text)] sm:text-[26px]">
              Ariza qoldirish
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
              Ism va telefon raqamingizni qoldiring — tez orada siz bilan bog&apos;lanamiz.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-7">
              <div className="relative flex flex-col gap-4">
                <div>
                  <div className={fieldClass(!!errors.fullName)}>
                    <PersonIcon className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Ismingiz"
                      value={values.fullName}
                      onChange={(e) => setField("fullName", e.target.value)}
                      className="w-full bg-transparent text-[15px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
                    />
                  </div>
                  {errors.fullName && <p className="mt-1.5 pl-5 text-[13px] text-red-500">{errors.fullName}</p>}
                </div>

                <div>
                  <div className={fieldClass(!!errors.phone)}>
                    <PhoneIcon className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={18}
                      value={values.phone}
                      onChange={(e) => setField("phone", formatUzPhoneInput(e.target.value))}
                      onFocus={(e) => {
                        const pos = e.currentTarget.value.length;
                        e.currentTarget.setSelectionRange(pos, pos);
                      }}
                      onClick={(e) => {
                        const pos = e.currentTarget.value.length;
                        if (e.currentTarget.selectionStart !== null && e.currentTarget.selectionStart < PHONE_PREFIX.length + 1) {
                          e.currentTarget.setSelectionRange(pos, pos);
                        }
                      }}
                      className="w-full bg-transparent text-[15px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
                    />
                  </div>
                  {errors.phone && <p className="mt-1.5 pl-5 text-[13px] text-red-500">{errors.phone}</p>}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  aria-label="Arizani yuborish"
                  className="absolute top-1/2 -right-3 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-[var(--shadow-cta)] transition-transform duration-150 hover:scale-[1.06] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:-right-4"
                  style={{ background: "linear-gradient(135deg, var(--color-green) 0%, var(--color-green-dark) 100%)" }}
                >
                  <CheckIcon className="h-6 w-6" />
                </button>
              </div>

              {submitError && (
                <p className="mt-5 rounded-[var(--radius-md)] bg-red-50 px-4 py-3 text-[13.5px] text-red-600">
                  {submitError}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
