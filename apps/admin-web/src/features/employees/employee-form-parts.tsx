"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Position, Subject } from "@/lib/types";
import { IosSheet } from "@/components/ios/sheet";
import { FormSection } from "@/components/ios/form";
import { Row } from "@/components/ios/group";
import { CameraIcon, CheckIcon, ChevronRightIcon, CopyIcon, PlusIcon } from "@/components/ios/icons";
import { Spinner } from "@/components/ios/spinner";
import { ROW_SEPARATOR } from "@/components/ios/tokens";
import { prepareChildPhoto } from "@/lib/child-photo";
import { normalizePosition } from "@/lib/employee-position";
import { validateUzbekPhone } from "@/lib/phone";
import { useTr } from "@/i18n/tr";

const PHONE_ERRORS = {
  prefix: "Telefon raqami +998 bilan boshlanishi kerak",
  length: "Telefon raqami 9 xonali bo'lishi kerak (+998 dan keyin)",
  code: "Bunday operator kodi mavjud emas (masalan: 90, 91, 93, 94, 95, 97, 98, 99)",
} as const;

/** O'zbekiston mobil raqami tekshiruvi — xato matni yoki undefined */
export function phoneErrorText(phone: string): string | undefined {
  const error = validateUzbekPhone(phone);
  return error ? PHONE_ERRORS[error] : undefined;
}

/**
 * Xodim varaqlari (yangi xodim, tahrirlash, xodim varag'i) uchun umumiy
 * iOS qismlari: surat tanlash, tanlash qatori, ✓ qatori, nusxalash qatori
 * va lavozim/fan katalogi varag'i.
 */

/** Surat — Kontaktlar ilovasidagidek tepada, markazda. Yuz brauzerda tekshiriladi. */
export function PhotoPickerHero({
  preview,
  hasPhoto,
  initialsText,
  onPick,
  onRemove,
  hint,
  error,
}: {
  /** Ko'rsatiladigan surat (yangi tanlangan yoki saqlangan); yo'q bo'lsa — bosh harflar */
  preview: React.ReactNode | null;
  hasPhoto: boolean;
  initialsText: string;
  onPick: (image: string) => void;
  /** Berilmasa «Olib tashlash» ko'rinmaydi */
  onRemove?: () => void;
  hint: string;
  /** Tashqi xato (masalan, «surat majburiy») */
  error?: string | null;
}) {
  const tr = useTr();
  const fileRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPickError(null);
    setChecking(true);
    try {
      const result = await prepareChildPhoto(file);
      if (result.ok) onPick(result.image);
      else setPickError(result.reason.replace("Bolaning", "Xodimning").replace("bolaning", "xodimning"));
    } finally {
      setChecking(false);
    }
  };

  const shownError = pickError ?? error;
  return (
    <div className="flex flex-col items-center gap-1.5 pt-1">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={checking}
        aria-label={hasPhoto ? tr("Suratni almashtirish") : tr("Surat qo'yish")}
        className={clsx(
          "relative h-[88px] w-[88px] rounded-full transition-transform active:scale-[0.97] disabled:cursor-wait",
          shownError && !hasPhoto && "ring-2 ring-[#ff3b30] ring-offset-2 ring-offset-[#f2f2f7]",
        )}
      >
        {hasPhoto && preview ? (
          preview
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#8e8e93] text-[30px] font-semibold text-white">
            {initialsText || <CameraIcon className="h-8 w-8" />}
          </span>
        )}
        <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f2f2f7] bg-[var(--color-primary)] text-white">
          {checking ? <Spinner className="h-3.5 w-3.5 text-white" /> : <CameraIcon className="h-3.5 w-3.5" strokeWidth={2.4} />}
        </span>
      </button>
      <div className="flex items-center gap-4 text-[15px] font-medium">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={checking} className="text-[var(--color-primary)] transition-opacity active:opacity-50">
          {checking ? tr("Tekshirilmoqda…") : hasPhoto ? tr("Almashtirish") : tr("Surat qo'yish")}
        </button>
        {hasPhoto && !checking && onRemove && (
          <button type="button" onClick={onRemove} className="text-[#ff3b30] transition-opacity active:opacity-50">
            {tr("Olib tashlash")}
          </button>
        )}
      </div>
      {shownError ? (
        <p role="alert" className="max-w-[320px] text-center text-[12.5px] text-[#ff3b30]">
          {tr(shownError)}
        </p>
      ) : (
        <p className="max-w-[320px] text-center text-[12.5px] text-[#8e8e93]">{tr(hint)}</p>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
    </div>
  );
}

/** Forma qatori: chapda yorliq, o'ngda tanlangan qiymat va «›» — bosilsa ro'yxat ochiladi */
export function PickerRow({ label, value, placeholder, onClick, error }: { label: string; value: string; placeholder: string; onClick: () => void; error?: string }) {
  const tr = useTr();
  return (
    <div className={clsx("group/row relative", error && "bg-[#ff3b30]/[0.06]")}>
      <button type="button" onClick={onClick} className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]">
        <span className="w-[108px] shrink-0 py-3 text-[15px] text-[var(--color-text)]">{label}</span>
        <span className={clsx("min-w-0 flex-1 truncate text-right text-[15px]", value ? "text-[#8e8e93]" : "text-[#c4c4c6]")}>{value || placeholder}</span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={2.2} aria-hidden="true" />
      </button>
      {error && (
        <p role="alert" className="-mt-1 px-4 pb-2.5 text-[12.5px] leading-snug text-[#ff3b30]">
          {tr(error)}
        </p>
      )}
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

/** Ro'yxatdan bittasini tanlash qatori — tanlangani o'ngda ✓ */
export function CheckRow({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <div className="group/row relative">
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={onClick}
        className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
      >
        <span className="min-w-0 flex-1 truncate py-3 text-[15px] text-[var(--color-text)]">{label}</span>
        {checked && <CheckIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
      </button>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

/** Bir martalik ko'rsatiladigan login/parol qatori — nusxalash tugmasi bilan */
export function CopyRow({ label, value }: { label: string; value: string }) {
  const tr = useTr();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard ruxsati yo'q — qiymat ekranda ko'rinib turadi
    }
  };
  return (
    <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4">
      <span className="w-[72px] shrink-0 text-[15px] text-[var(--color-text)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[15px] text-[var(--color-text)]">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={tr("Nusxalash")}
        className={clsx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#767680]/[0.12]",
          copied ? "text-[#34c759]" : "text-[var(--color-primary)]",
        )}
      >
        {copied ? <CheckIcon className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <CopyIcon className="h-[18px] w-[18px]" />}
      </button>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

const CATALOG = {
  position: {
    title: "Lavozim",
    endpoint: "/app/positions",
    queryKey: "positions",
    placeholder: "Masalan, Hovli farroshi",
    tooShort: "Lavozim nomi kamida 2 belgi",
    createFailed: "Lavozim yaratib bo'lmadi",
    empty: "Hozircha lavozim yo'q — pastdan qo'shing",
  },
  subject: {
    title: "Fan",
    endpoint: "/app/subjects",
    queryKey: "subjects",
    placeholder: "Masalan, Rus tili",
    tooShort: "Fan nomi kamida 2 belgi",
    createFailed: "Fan yaratib bo'lmadi",
    empty: "Hozircha fan yo'q — pastdan qo'shing",
  },
} as const;

/**
 * Lavozim yoki fan katalogi — ichki varaq: ro'yxatdan tanlash (✓) yoki
 * pastdagi maydondan yangisini qo'shish. Tanlangach (yoki qo'shilgach)
 * varaq o'zi yopiladi. Ro'yxatda yo'q joriy qiymat ham ko'rinib turadi.
 */
export function CatalogPickerSheet({
  open,
  onClose,
  kind,
  slug,
  selected,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  kind: "position" | "subject";
  slug: string;
  selected: string;
  onSelect: (name: string) => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const c = CATALOG[kind];
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open, kind]);

  const query = useQuery({
    queryKey: [c.queryKey, slug],
    queryFn: () => api.get<(Position | Subject)[]>(c.endpoint),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: (value: string) => api.post<Position | Subject>(c.endpoint, { name: value }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: [c.queryKey, slug] });
      onSelect(created.name);
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : c.createFailed),
  });

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(c.tooShort);
      return;
    }
    create.mutate(trimmed);
  };

  const same = (a: string, b: string) => (kind === "position" ? normalizePosition(a) === normalizePosition(b) : a === b);
  const names = (query.data ?? []).map((item) => item.name);
  const options = !selected || names.some((n) => same(n, selected)) ? names : [selected, ...names];

  return (
    <IosSheet open={open} onClose={onClose} cancelLabel="Orqaga" title={tr(c.title)}>
      <FormSection>
        {query.isLoading ? (
          <Row title={<span className="text-[#8e8e93]">{tr("Yuklanmoqda...")}</span>} />
        ) : options.length === 0 ? (
          <Row title={<span className="text-[#8e8e93]">{tr(c.empty)}</span>} />
        ) : (
          options.map((n) => (
            <CheckRow
              key={n}
              label={tr(n)}
              checked={same(n, selected)}
              onClick={() => {
                onSelect(n);
                onClose();
              }}
            />
          ))
        )}
      </FormSection>

      <FormSection
        title={tr("Yangi qo'shish")}
        footer={error ? <span className="text-[#ff3b30]">{tr(error)}</span> : tr("Qo'shilgani bog'chaning ro'yxatiga yoziladi va shu yerda tanlanadi.")}
      >
        <div className="flex min-h-[52px] items-center gap-2 pl-4 pr-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={tr(c.placeholder)}
            maxLength={80}
            aria-label={tr(c.title)}
            className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-[var(--color-primary)] px-3.5 text-[14px] font-semibold text-white transition-transform active:scale-[0.96] disabled:opacity-60"
          >
            {create.isPending ? <Spinner className="h-4 w-4 text-white" /> : <PlusIcon className="h-4 w-4" strokeWidth={2.6} />}
            {tr("Qo'shish")}
          </button>
        </div>
      </FormSection>
    </IosSheet>
  );
}
