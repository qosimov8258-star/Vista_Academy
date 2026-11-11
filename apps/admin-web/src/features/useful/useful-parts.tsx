"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { BookOpen, Feather, Lightbulb, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import type { Group as GroupModel, UsefulStatus } from "@/lib/types";
import { useAppPathname } from "@/lib/tenant-host-context";
import { IosSheet, SheetSection } from "@/components/ios/sheet";
import { FormSection, IosSwitch, Segmented } from "@/components/ios/form";
import { Row } from "@/components/ios/group";
import { PageHeaderCard } from "@/components/ios/page-card";
import { IosButton } from "@/components/ios/button";
import { Pill } from "@/components/ios/pill";
import { ChipRow, IosChip, SearchPill } from "@/components/ios/filters";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { Spinner } from "@/components/ios/spinner";
import { CheckIcon, ChevronRightIcon, InfoIcon, type IconProps } from "@/components/ios/icons";
import { GROUP_BLOCK, IOS, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IosIcon, type IosTint } from "@/features/director/ios-icon";
import { useTr } from "@/i18n/tr";

/**
 * «Foydali» bo'limining umumiy iOS qismlari: sahifa qobig'i (sarlavha,
 * bo'limlar segmenti, qidiruv, guruh chiplari, ro'yxat), ko'rish varag'i
 * (amallar va o'chirishni tasdiqlash bilan) va tahrirlash formalari uchun
 * qatorlar (guruh, yosh, holat, katta matn maydoni).
 *
 * Telefon birinchi o'rinda: maydonlar 16px (iOS Safari kattalashtirmaydi),
 * bosiladigan joy kamida 44px, native `<select>` yo'q.
 */

export type UsefulKind = "poems" | "proverbs" | "tales";

export const USEFUL_KINDS: Record<
  UsefulKind,
  { label: string; noun: string; add: string; icon: ComponentType<IconProps>; tint: IosTint }
> = {
  poems: { label: "She'rlar", noun: "she'r", add: "Yangi she'r", icon: Feather, tint: "purple" },
  proverbs: { label: "Maqollar", noun: "maqol", add: "Yangi maqol", icon: Lightbulb, tint: "orange" },
  tales: { label: "Ertaklar", noun: "ertak", add: "Yangi ertak", icon: BookOpen, tint: "teal" },
};

export interface UsefulListItem {
  id: string;
  title: string;
  /** Ikkinchi qator (maqolning ma'nosi) — 2 qatorgacha ko'rinadi */
  detail?: string | null;
  meta: string;
  draft: boolean;
  /** Qidiruv uchun qo'shimcha matn */
  searchText?: string;
}

/** Qidiruvda harf katta-kichikligi va o'zbekcha tutuq belgilari farq qilmasin */
function norm(value: string): string {
  return value.toLowerCase().replace(/[ʻʼ‘’`']/g, "'");
}

/** Sahifa qobig'i — uchala bo'lim uchun bir xil */
export function UsefulScreen({
  kind,
  base,
  canWrite,
  onAdd,
  groups,
  groupFilter,
  onGroupFilter,
  items,
  loading,
  error,
  onRetry,
  retrying,
  onOpen,
  children,
}: {
  kind: UsefulKind;
  /** Bo'lim manzili boshi (`/slug` yoki `/slug/filial`) */
  base: string;
  canWrite: boolean;
  onAdd: () => void;
  groups: GroupModel[];
  groupFilter: string;
  onGroupFilter: (id: string) => void;
  items: UsefulListItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  retrying: boolean;
  onOpen: (id: string) => void;
  /** Sahifaning varaqlari (ko'rish, tahrirlash) */
  children?: ReactNode;
}) {
  const tr = useTr();
  const router = useRouter();
  const pathname = useAppPathname();
  const k = USEFUL_KINDS[kind];
  const [search, setSearch] = useState("");

  const tabs = (Object.keys(USEFUL_KINDS) as UsefulKind[]).map((key) => ({
    value: `${base}/useful/${key}`,
    label: tr(USEFUL_KINDS[key].label),
  }));
  const current = tabs.find((t) => pathname.startsWith(t.value))?.value ?? `${base}/useful/${kind}`;

  const q = norm(search.trim());
  const shown = q ? items.filter((it) => norm(`${it.title} ${it.detail ?? ""} ${it.searchText ?? ""}`).includes(q)) : items;
  const drafts = items.filter((it) => it.draft).length;

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={k.icon}
          tint={k.tint}
          title={tr("Foydali")}
          count={loading ? undefined : items.length}
          subtitle={drafts > 0 ? tr("{0} tasi qoralama · ota-onalar ko'rmaydi", drafts) : tr("Ota-ona kabinetida ham ko'rinadi")}
          actions={canWrite ? <IosButton label={tr(k.add)} icon={Plus} variant="primary" compact onClick={onAdd} /> : undefined}
        />

        <div className="space-y-3">
          <Segmented label={tr("Bo'lim")} value={current} onChange={(href) => router.push(href)} options={tabs} />
          {items.length > 3 && <SearchPill value={search} onChange={setSearch} placeholder={tr("Qidirish")} />}
          {groups.length > 1 && (
            <ChipRow label={tr("Guruh")}>
              <IosChip active={groupFilter === ""} onClick={() => onGroupFilter("")}>
                {tr("Barcha guruhlar")}
              </IosChip>
              {groups.map((g) => (
                <IosChip key={g.id} active={groupFilter === g.id} onClick={() => onGroupFilter(g.id)}>
                  {tr(g.name)}
                </IosChip>
              ))}
            </ChipRow>
          )}
        </div>

        {!canWrite && (
          <div className={clsx(GROUP_BLOCK, "flex items-start gap-3 px-4 py-3.5")}>
            <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#8e8e93]" />
            <p className="text-[13.5px] leading-snug text-[#8e8e93]">
              {tr("Faqat ko'rish. She'r, maqol va ertaklarni tarbiyachilar va filial admini qo'shadi.")}
            </p>
          </div>
        )}

        {loading ? (
          <SkeletonRows rows={5} avatar={false} />
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} retrying={retrying} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={k.icon}
            title={tr("Hali {0} yo'q", tr(k.noun))}
            hint={canWrite ? tr("«{0}» tugmasi bilan birinchisini qo'shing — ota-onalar kabinetida darhol ko'radi.", tr(k.add)) : undefined}
          />
        ) : shown.length === 0 ? (
          <EmptyState icon={k.icon} title={tr("Hech narsa topilmadi")} hint={tr("Boshqa so'z bilan qidirib ko'ring")} />
        ) : (
          <div className={GROUP_BLOCK}>
            {shown.map((item) => (
              <div key={item.id} className="group/row relative">
                <button type="button" onClick={() => onOpen(item.id)} className={clsx("flex min-h-[64px] w-full items-center gap-3 py-2.5 pl-4 pr-3 text-left", ROW_PRESS)}>
                  <IosIcon icon={k.icon} tint={k.tint} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className={clsx("block text-[15.5px] font-medium leading-snug text-[var(--color-text)]", item.detail ? "line-clamp-2" : "truncate")}>
                      {tr(item.title)}
                    </span>
                    {item.detail && <span className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-[var(--color-text)]/70">{tr(item.detail)}</span>}
                    <span className="mt-0.5 block truncate text-[13px] text-[#8e8e93]">{tr(item.meta)}</span>
                  </span>
                  {item.draft && <Pill color={IOS.orange}>{tr("Qoralama")}</Pill>}
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={2.2} aria-hidden="true" />
                </button>
                <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}

/**
 * Ko'rish varag'i: ota-onalar ko'radigan ko'rinish + ma'lumot qatorlari +
 * amallar. O'chirish — varaq ichida ikkinchi bosqich.
 */
export function UsefulViewSheet({
  open,
  onClose,
  title,
  noun,
  children,
  info,
  canEdit,
  onEdit,
  onDelete,
  deleting,
  deleteError,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** "she'r", "maqol", "ertak" */
  noun: string;
  children: ReactNode;
  info: { label: string; value: ReactNode }[];
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  deleteError: string | null;
}) {
  const tr = useTr();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (open) setConfirming(false);
  }, [open]);

  return (
    <IosSheet open={open} onClose={() => !deleting && onClose()} cancelLabel="Yopish" title={tr(title)}>
      {children}

      <SheetSection title={tr("Ma'lumot")}>
        {info.map((row) => (
          <div key={row.label} className="group/row relative flex min-h-[48px] items-center gap-3 px-4">
            <span className="shrink-0 py-3 text-[15px] text-[var(--color-text)]">{tr(row.label)}</span>
            <span className="min-w-0 flex-1 truncate py-3 text-right text-[15px] text-[#8e8e93]">{row.value}</span>
            <span className={ROW_SEPARATOR} aria-hidden="true" />
          </div>
        ))}
      </SheetSection>

      {canEdit && (
        <SheetSection title={tr("Amallar")}>
          <Row leading={<IosIcon icon={Pencil} tint="blue" size={30} />} title={tr("Tahrirlash")} onClick={onEdit} />
          {!confirming ? (
            <Row
              leading={<IosIcon icon={Trash2} tint="red" size={30} />}
              title={<span className="text-[#ff3b30]">{tr("O'chirish")}</span>}
              onClick={() => setConfirming(true)}
              chevron={false}
            />
          ) : (
            <div className="group/row relative space-y-3 bg-[#ff3b30]/[0.06] px-4 py-3.5">
              <p className="text-[14px] leading-snug text-[#ff3b30]">
                {tr("Bu {0} o'chiriladi va ota-onalar kabinetidan ham yo'qoladi. Qaytarib bo'lmaydi.", tr(noun))}
              </p>
              {deleteError && <p className="text-[13px] text-[#ff3b30]">{tr(deleteError)}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirming(false)}
                  className="h-11 flex-1 rounded-full bg-white text-[15px] font-semibold text-[var(--color-text)] transition-transform active:scale-[0.97]"
                >
                  {tr("Qoldirish")}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={onDelete}
                  className="flex h-11 flex-1 items-center justify-center rounded-full bg-[#ff3b30] text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  {deleting ? <Spinner className="h-4 w-4 text-white" /> : tr("O'chirish")}
                </button>
              </div>
              <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
            </div>
          )}
        </SheetSection>
      )}
    </IosSheet>
  );
}

/** Varaqdagi o'qish yuzasi — ota-ona ko'radigan matn uchun oq karta */
export function ReadingCard({ children }: { children: ReactNode }) {
  return <div className={clsx(GROUP_BLOCK, "space-y-4 px-5 py-5")}>{children}</div>;
}

/* ---------------- Tahrirlash formasi qatorlari ---------------- */

/** Forma maydonlari — 16px: iOS Safari fokusda sahifani kattalashtirmaydi */
export const FIELD = "w-full bg-transparent text-[16px] text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]";

/** Bir qatorli maydon: chapda yorliq, o'ngda chegarasiz input */
export function InputRow({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  error,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  error?: string;
  inputMode?: "text" | "numeric";
}) {
  const tr = useTr();
  return (
    <label className={clsx("group/row relative block px-4", error && "bg-[#ff3b30]/[0.06]")}>
      <span className="flex min-h-[50px] items-center gap-3">
        <span className="w-[104px] shrink-0 text-[15px] text-[var(--color-text)]">{tr(label)}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ? tr(placeholder) : undefined}
          maxLength={maxLength}
          inputMode={inputMode}
          className={clsx(FIELD, "min-w-0 flex-1 py-3 text-right")}
        />
      </span>
      {error && (
        <span role="alert" className="-mt-1 block pb-2.5 text-[12.5px] leading-snug text-[#ff3b30]">
          {tr(error)}
        </span>
      )}
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </label>
  );
}

/**
 * Katta matn maydoni (karta ichida to'liq kenglikda) — yozgan sari
 * balandligi o'sadi, pastda belgilar hisoblagichi.
 */
export function TextBlock({
  value,
  onChange,
  placeholder,
  maxLength,
  minRows = 3,
  error,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  minRows?: number;
  error?: string;
  ariaLabel: string;
}) {
  const tr = useTr();
  const ref = useRef<HTMLTextAreaElement>(null);
  // Matnga qarab o'sadi — telefonda ichki aylantirish kerak bo'lmasin
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  const near = value.length > maxLength * 0.9;
  return (
    <div className={clsx("group/row relative px-4 pb-2 pt-3", error && "bg-[#ff3b30]/[0.06]")}>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ? tr(placeholder) : undefined}
        maxLength={maxLength}
        rows={minRows}
        aria-label={tr(ariaLabel)}
        className={clsx(FIELD, "block resize-none leading-relaxed")}
      />
      <div className="mt-1 flex items-center justify-between gap-3">
        <span role={error ? "alert" : undefined} className="min-w-0 text-[12.5px] leading-snug text-[#ff3b30]">
          {error ? tr(error) : ""}
        </span>
        <span className={clsx("shrink-0 text-[12px] tabular-nums", near ? "text-[#ff9500]" : "text-[#c4c4c6]")}>
          {value.length}/{maxLength}
        </span>
      </div>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

/** Guruh qatori → ichki varaq ro'yxati (✓), tanlangach o'zi yopiladi */
export function GroupPickerRow({
  groups,
  value,
  onChange,
  allowWholeBranch,
  error,
}: {
  groups: GroupModel[];
  value: string;
  onChange: (id: string) => void;
  /** Tarbiyachidan boshqalar "Butun filial"ni ham tanlay oladi */
  allowWholeBranch: boolean;
  error?: string;
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const options = [...(allowWholeBranch ? [{ id: "", name: tr("Butun filial") }] : []), ...groups.map((g) => ({ id: g.id, name: tr(g.name) }))];
  const selected = options.find((o) => o.id === value && (o.id !== "" || allowWholeBranch));
  return (
    <>
      <div className={clsx("group/row relative", error && "bg-[#ff3b30]/[0.06]")}>
        <button type="button" onClick={() => setOpen(true)} className={clsx("flex min-h-[50px] w-full items-center gap-3 px-4 text-left", ROW_PRESS)}>
          <span className="w-[104px] shrink-0 text-[15px] text-[var(--color-text)]">{tr("Guruh")}</span>
          <span className={clsx("min-w-0 flex-1 truncate text-right text-[16px]", selected ? "text-[#8e8e93]" : "text-[#c4c4c6]")}>
            {selected?.name ?? tr("Tanlang")}
          </span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={2.2} aria-hidden="true" />
        </button>
        {error && (
          <p role="alert" className="-mt-1 px-4 pb-2.5 text-[12.5px] leading-snug text-[#ff3b30]">
            {tr(error)}
          </p>
        )}
        <span className={ROW_SEPARATOR} aria-hidden="true" />
      </div>
      <IosSheet open={open} onClose={() => setOpen(false)} cancelLabel="Orqaga" title={tr("Guruh")}>
        <FormSection footer={tr("Ota-onalar faqat o'z farzandining guruhi uchun qo'shilganini ko'radi.")}>
          {options.length === 0 ? (
            <Row title={<span className="text-[#8e8e93]">{tr("Sizga hali guruh biriktirilmagan")}</span>} />
          ) : (
            options.map((o) => (
              <div key={o.id || "all"} className="group/row relative">
                <button
                  type="button"
                  role="radio"
                  aria-checked={o.id === value}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={clsx("flex min-h-[50px] w-full items-center gap-3 px-4 text-left", ROW_PRESS)}
                >
                  <span className="min-w-0 flex-1 truncate py-3 text-[16px] text-[var(--color-text)]">{o.name}</span>
                  {o.id === value && selected && <CheckIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
                </button>
                <span className={ROW_SEPARATOR} aria-hidden="true" />
              </div>
            ))
          )}
        </FormSection>
      </IosSheet>
    </>
  );
}

/** Yosh oralig'i: ikki kichik −/+ (2–7 yosh), «dan» «gacha»dan oshmaydi */
export function AgeRangeRow({ from, to, onChange }: { from: number; to: number; onChange: (from: number, to: number) => void }) {
  const tr = useTr();
  return (
    <div className="group/row relative flex min-h-[56px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
      <span className="w-[104px] shrink-0 text-[15px] text-[var(--color-text)]">{tr("Yosh")}</span>
      <div className="ml-auto flex items-center gap-2">
        <Stepper value={from} min={2} max={to} onChange={(v) => onChange(v, to)} label={tr("Yosh (dan)")} />
        <span className="text-[#8e8e93]">–</span>
        <Stepper value={to} min={from} max={7} onChange={(v) => onChange(from, v)} label={tr("Yosh (gacha)")} />
        <span className="text-[15px] text-[#8e8e93]">{tr("yosh")}</span>
      </div>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (value: number) => void; label: string }) {
  const tr = useTr();
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-primary)] transition-[transform,opacity] active:scale-90 disabled:text-[#c7c7cc]";
  return (
    <div role="group" aria-label={label} className="flex items-center rounded-full bg-[#767680]/[0.12]">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={tr("Kamaytirish")}>
        <Minus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="w-5 text-center text-[16px] font-semibold tabular-nums text-[var(--color-text)]">{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={tr("Ko'paytirish")}>
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </div>
  );
}

/** «Ota-onalarga ko'rsatish» — yoqiq: chop etilgan, o'chiq: qoralama */
export function PublishRow({ status, onChange }: { status: UsefulStatus; onChange: (status: UsefulStatus) => void }) {
  const tr = useTr();
  return (
    <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4">
      <span className="flex-1 text-[15px] text-[var(--color-text)]">{tr("Ota-onalarga ko'rsatish")}</span>
      <IosSwitch checked={status === "PUBLISHED"} onChange={(on) => onChange(on ? "PUBLISHED" : "DRAFT")} label={tr("Ota-onalarga ko'rsatish")} />
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

export function publishFooter(status: UsefulStatus): string {
  return status === "PUBLISHED"
    ? "Saqlangach ota-onalar kabinetida darhol ko'rinadi."
    : "Qoralama — faqat sizga ko'rinadi. Tayyor bo'lgach yoqing.";
}

/** Formaning umumiy xato matni */
export function FormError({ message }: { message: string | null }) {
  const tr = useTr();
  if (!message) return null;
  return (
    <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
      {tr(message)}
    </p>
  );
}

/** Varaq ichidagi «Yozish / Ko'rinishi» almashtirgichi — telefonda ekran tor */
export function WritePreviewToggle({ value, onChange }: { value: "write" | "preview"; onChange: (v: "write" | "preview") => void }) {
  const tr = useTr();
  return (
    <Segmented
      label={tr("Ko'rinish")}
      value={value}
      onChange={onChange}
      options={[
        { value: "write", label: tr("Yozish") },
        { value: "preview", label: tr("Ko'rinishi") },
      ]}
    />
  );
}
