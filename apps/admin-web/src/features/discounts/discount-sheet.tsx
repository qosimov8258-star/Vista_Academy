"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowRight, Info, TriangleAlert, UsersRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { PeriodStepper } from "@/components/ios/day-stepper";
import { SearchPill } from "@/components/ios/filters";
import { Segmented } from "@/components/ios/form";
import { Row } from "@/components/ios/group";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { GROUP_BLOCK, IOS, ROW_PRESS, ROW_SEPARATOR, SECTION_TITLE } from "@/components/ios/tokens";
import { Toast, type ToastState } from "@/components/ui/toast";
import { currentMonth } from "@/features/cash/shared";
import { groupDigits, periodLabel, shiftPeriod } from "@/features/payments/shared";
import { useTr } from "@/i18n/tr";
import {
  DISCOUNT_COLOR,
  computeDiscount,
  formatPercent,
  matchesSearch,
  ruleLabel,
  scopeLabel,
  typeLabel,
  type DiscountChildHistory,
  type DiscountInvoiceResult,
  type DiscountMutationResult,
  type DiscountRow,
  type DiscountRule,
  type DiscountScope,
  type DiscountType,
} from "./shared";

const FILL = "bg-[#767680]/[0.12]";
const PICKER_LIMIT = 40;
export const REASON_CHIPS = ["Aka-uka / opa-singil", "Xodim farzandi", "Kelishuv", "Ijtimoiy yordam", "Ko'p bolali oila"];

// ---------------------------------------------------------------------------
// Forma (yakka va ommaviy varaq uchun umumiy)
// ---------------------------------------------------------------------------

export interface DiscountDraft {
  type: DiscountType;
  /** Kiritilgan qiymat: foiz — "12.5", summa — faqat raqamlar */
  raw: string;
  scope: DiscountScope;
  /** Bir oylik chegirma oyi (YYYY-MM) */
  month: string;
  reason: string;
  /** Turi almashtirilganda avvalgi qiymat yo'qolmasin */
  memory: Partial<Record<DiscountType, string>>;
}

export function newDraft(month: string, reason = ""): DiscountDraft {
  return { type: "PERCENTAGE", raw: "", scope: "PERMANENT", month, reason, memory: {} };
}

function draftFromRule(rule: DiscountRule, month: string): DiscountDraft {
  return {
    type: rule.type,
    raw: rule.type === "PERCENTAGE" ? formatPercent(rule.value) : String(Math.round(rule.value)),
    scope: rule.scope,
    month: rule.scope === "ONE_MONTH" ? rule.startPeriod : month,
    reason: rule.reason ?? "",
    memory: {},
  };
}

export function draftValue(d: DiscountDraft): number {
  const n = Number(d.raw);
  return Number.isFinite(n) ? n : 0;
}

/** Saqlashni to'xtatadigan sabab (tarjima qilinmagan kalit) yoki null */
export function draftProblem(d: DiscountDraft, gross: number): string | null {
  const value = draftValue(d);
  if (d.type === "PERCENTAGE" && value > 100) return "Foiz 100 dan oshmasin";
  if (!(gross > 0)) return "Oylik narx belgilanmagan";
  if (!(value > 0)) return "Qiymatni kiriting";
  return null;
}

function cleanPercent(input: string): string {
  const s = input.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  const int = (dot >= 0 ? s.slice(0, dot) : s).replace(/^0+(?=\d)/, "").slice(0, 3);
  if (dot < 0) return int;
  const dec = s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return `${int || "0"}.${dec}`;
}

function cleanAmount(input: string): string {
  return input.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9);
}

/**
 * Turi (foiz / summa / yakuniy narx), qiymat, muddat (doimiy / bir oylik)
 * va sabab. `gross` — oylik narx: summa undan katta bo'lsa ogohlantiradi.
 */
export function DiscountFormFields({
  draft,
  onChange,
  gross,
  currentPeriod,
  showErrors = false,
}: {
  draft: DiscountDraft;
  onChange: (next: DiscountDraft) => void;
  gross: number;
  currentPeriod: string;
  showErrors?: boolean;
}) {
  const tr = useTr();
  const value = draftValue(draft);
  const percent = draft.type === "PERCENTAGE";
  const overPercent = percent && value > 100;
  const overGross = !percent && gross > 0 && value > gross;
  const emptyError = showErrors && !(value > 0);

  const setType = (type: DiscountType) => {
    if (type === draft.type) return;
    const memory = { ...draft.memory, [draft.type]: draft.raw };
    onChange({ ...draft, type, raw: memory[type] ?? "", memory });
  };

  const caption =
    draft.type === "PERCENTAGE"
      ? tr("Oylik to'lovdan necha foiz chegirma")
      : draft.type === "FIXED_AMOUNT"
        ? tr("Oylik to'lovdan qancha ayiriladi")
        : tr("Bola oyiga qancha to'laydi");

  return (
    <section>
      <h3 className={SECTION_TITLE}>{tr("Chegirma")}</h3>
      <div className={clsx(GROUP_BLOCK, "space-y-4 p-4")}>
        <Segmented<DiscountType>
          value={draft.type}
          onChange={setType}
          label={tr("Chegirma turi")}
          options={[
            { value: "PERCENTAGE", label: tr("Foiz (%)") },
            { value: "FIXED_AMOUNT", label: tr("Summa") },
            {
              value: "FINAL_AMOUNT",
              // Telefonda uchta segmentga "Yakuniy narx" sig'maydi — qisqasi; ma'nosini ostidagi izoh aytadi
              label: (
                <>
                  <span className="sm:hidden">{tr("Narx")}</span>
                  <span className="hidden sm:inline">{tr("Yakuniy narx")}</span>
                </>
              ),
            },
          ]}
        />

        {/* Qiymat */}
        <div>
          <p className="pb-2 text-[13px] text-[#8e8e93]">{caption}</p>
          <label className={clsx("flex h-14 min-w-0 items-center gap-2 rounded-[14px] px-4", FILL, (overPercent || emptyError) && "ring-2 ring-[#ff3b30]")}>
            <input
              inputMode={percent ? "decimal" : "numeric"}
              autoComplete="off"
              aria-label={tr("Qiymat")}
              value={percent ? draft.raw : draft.raw ? groupDigits(draft.raw) : ""}
              placeholder="0"
              onChange={(e) => onChange({ ...draft, raw: percent ? cleanPercent(e.target.value) : cleanAmount(e.target.value) })}
              className="min-w-0 flex-1 bg-transparent text-[24px] font-bold tabular-nums text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]"
            />
            <span className="shrink-0 text-[15px] font-semibold text-[#8e8e93]">{percent ? "%" : tr("so'm")}</span>
          </label>
          {overPercent ? (
            <p className="px-1 pt-2 text-[13px] text-[#ff3b30]">{tr("Foiz 100 dan oshmasin")}</p>
          ) : overGross ? (
            <p className="px-1 pt-2 text-[13px] text-[#c93400]">{tr("Oylik to'lovdan ({0}) katta", groupDigits(gross))}</p>
          ) : emptyError ? (
            <p className="px-1 pt-2 text-[13px] text-[#ff3b30]">{tr("Qiymatni kiriting")}</p>
          ) : null}
        </div>

        {/* Muddat */}
        <div className="space-y-2.5">
          <Segmented<DiscountScope>
            value={draft.scope}
            onChange={(scope) => onChange({ ...draft, scope })}
            label={tr("Muddat")}
            options={[
              { value: "PERMANENT", label: tr("Doimiy") },
              { value: "ONE_MONTH", label: tr("Bir oylik") },
            ]}
          />
          {draft.scope === "PERMANENT" ? (
            <p className="px-1 text-[13px] leading-snug text-[#8e8e93]">
              {tr("{0} oyidan boshlab har oyga. O'tgan oylar o'zgarmaydi.", periodLabel(currentPeriod, tr))}
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] text-[var(--color-text)]">{tr("Qaysi oy uchun")}</span>
              <PeriodStepper
                onPrev={() => onChange({ ...draft, month: shiftPeriod(draft.month, -1) })}
                onNext={() => onChange({ ...draft, month: shiftPeriod(draft.month, 1) })}
                prevLabel={tr("Oldingi oy")}
                nextLabel={tr("Keyingi oy")}
              >
                {periodLabel(draft.month, tr)}
              </PeriodStepper>
            </div>
          )}
        </div>

        {/* Sabab */}
        <div className="space-y-2.5">
          <input
            value={draft.reason}
            onChange={(e) => onChange({ ...draft, reason: e.target.value.slice(0, 200) })}
            placeholder={tr("Sabab (ixtiyoriy)")}
            aria-label={tr("Sabab")}
            className={clsx("h-11 w-full rounded-[12px] px-3.5 text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#8e8e93]", FILL)}
          />
          <div className="flex flex-wrap gap-2">
            {REASON_CHIPS.map((r) => {
              const active = draft.reason === tr(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onChange({ ...draft, reason: active ? "" : tr(r) })}
                  aria-pressed={active}
                  className={clsx(
                    "h-9 rounded-full px-3.5 text-[14px] font-medium transition-transform active:scale-[0.96]",
                    active ? "bg-[var(--color-primary)] text-white" : clsx(FILL, "text-[var(--color-text)]"),
                  )}
                >
                  {tr(r)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Natija · Oy": Chegirmasiz → Chegirma → To'laydi */
export function DiscountPreview({ gross, discount, month }: { gross: number; discount: number; month: string }) {
  const tr = useTr();
  if (!(gross > 0)) {
    return (
      <Note tone="orange" icon={TriangleAlert}>
        {tr("Bu bolaning oylik narxi belgilanmagan")}
      </Note>
    );
  }
  const net = gross - discount;
  const pct = gross > 0 ? Math.round((discount / gross) * 100) : 0;
  return (
    <section>
      <h3 className={SECTION_TITLE}>
        {tr("Natija")} · {periodLabel(month, tr)}
      </h3>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 rounded-[18px] bg-white px-3 py-3.5">
        <PreviewCell label={tr("Chegirmasiz")} value={groupDigits(gross)} />
        <ArrowRight className="h-4 w-4 text-[#c7c7cc]" strokeWidth={2.2} aria-hidden="true" />
        <PreviewCell label={pct > 0 ? `${tr("Chegirma")} ${pct}%` : tr("Chegirma")} value={discount > 0 ? `−${groupDigits(discount)}` : "0"} color={discount > 0 ? DISCOUNT_COLOR : undefined} />
        <ArrowRight className="h-4 w-4 text-[#c7c7cc]" strokeWidth={2.2} aria-hidden="true" />
        <PreviewCell label={tr("To'laydi")} value={groupDigits(net)} strong />
      </div>
    </section>
  );
}

function PreviewCell({ label, value, color, strong }: { label: string; value: string; color?: string; strong?: boolean }) {
  return (
    <div className="min-w-0 text-center">
      <p className="truncate text-[12px] text-[#8e8e93]">{label}</p>
      <p className={clsx("truncate tabular-nums", strong ? "text-[17px] font-bold" : "text-[15px] font-semibold")} style={{ color: color ?? "var(--color-text)" }}>
        {value}
      </p>
    </div>
  );
}

const NOTE_TONE = {
  gray: { bg: "rgba(118,118,128,0.12)", fg: "#8e8e93" },
  orange: { bg: "rgba(255,149,0,0.12)", fg: "#ff9500" },
  red: { bg: "rgba(255,59,48,0.10)", fg: "#ff3b30" },
  blue: { bg: "rgba(0,122,255,0.10)", fg: "#007aff" },
} as const;

export function Note({ tone, icon: Icon, children }: { tone: keyof typeof NOTE_TONE; icon: typeof Info; children: ReactNode }) {
  const t = NOTE_TONE[tone];
  return (
    <div className="flex items-start gap-2.5 rounded-[16px] px-4 py-3 text-[13.5px] leading-snug text-[var(--color-text)]" style={{ backgroundColor: t.bg }}>
      <Icon className="mt-[1px] h-[18px] w-[18px] shrink-0" style={{ color: t.fg }} strokeWidth={2.2} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Natija xabari: "To'langan oylar o'zgarmadi: Sentabr 2026" */
export function invoicesNote(invoices: DiscountInvoiceResult | undefined, tr: (key: string, ...args: unknown[]) => string): string | null {
  const paid = [...new Set(invoices?.paidUnchanged ?? [])];
  if (!paid.length) return null;
  return tr("To'langan oylar o'zgarmadi: {0}", paid.map((p) => periodLabel(p, tr)).join(", "));
}

export function useDiscountInvalidate() {
  const queryClient = useQueryClient();
  // Chegirma hisob-fakturalarga ham tegadi — to'lovlar, qarzlar va bola sahifasi ham yangilansin
  return () => queryClient.invalidateQueries();
}

// ---------------------------------------------------------------------------
// Varaq
// ---------------------------------------------------------------------------

type Mode = "view" | "pick" | "edit" | "confirm";

/**
 * Bola chegirmasi varag'i. Qator bilan ochilsa — ko'rish (summalar, qoida,
 * tarix), u yerdan tahrirlash yoki bekor qilish (varaq ichida tasdiqlash).
 * Qatorsiz ("+") ochilsa — avval bola tanlanadi, keyin yangi chegirma
 * formasi. Saqlangach varaq yopiladi va natija qisqa xabarda ko'rinadi.
 */
export function DiscountSheet({
  open,
  onClose,
  slug,
  period,
  row,
  rows,
  canWrite,
  currentPeriod: currentPeriodProp,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  /** Sahifada tanlangan oy */
  period: string;
  row?: DiscountRow | null;
  /** Bola tanlash ro'yxati uchun */
  rows: DiscountRow[];
  canWrite: boolean;
  /** Toshkent bo'yicha joriy oy (API'dan); berilmasa brauzerda hisoblanadi */
  currentPeriod?: string;
}) {
  const tr = useTr();
  const invalidate = useDiscountInvalidate();
  const cur = currentPeriodProp || currentMonth();

  const [current, setCurrent] = useState<DiscountRow | null>(row ?? null);
  const [mode, setMode] = useState<Mode>("view");
  const [editFrom, setEditFrom] = useState<"view" | "pick">("view");
  const [editing, setEditing] = useState<DiscountRule | null>(null);
  const [draft, setDraft] = useState<DiscountDraft>(() => newDraft(period));
  const [search, setSearch] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Har ochilishda toza holatdan
  useEffect(() => {
    if (!open) return;
    setCurrent(row ?? null);
    setMode(row ? "view" : "pick");
    setEditFrom(row ? "view" : "pick");
    setEditing(null);
    setDraft(newDraft(period));
    setSearch("");
    setShowErrors(false);
    setError(null);
  }, [open, row?.childId, period]);

  const childId = current?.childId ?? "";
  const historyQuery = useQuery({
    queryKey: ["discount-child", slug, childId],
    queryFn: () => api.get<DiscountChildHistory>(`/app/discounts/child/${childId}`),
    enabled: open && mode === "view" && !!childId,
  });

  const rule = current?.rule ?? null;
  const gross = current?.gross ?? 0;
  const value = draftValue(draft);
  const previewDiscount = computeDiscount(draft.type, value, gross);
  const previewMonth = draft.scope === "ONE_MONTH" ? draft.month : period > cur ? period : cur;
  const problem = draftProblem(draft, gross);

  // Tahrirlashda faqat o'zgargan maydonlar yuboriladi
  const patchBody = useMemo(() => {
    if (!editing) return null;
    const body: Record<string, unknown> = {};
    if (draft.type !== editing.type) body.type = draft.type;
    if (draft.scope !== editing.scope) body.scope = draft.scope;
    if (value !== editing.value) body.value = value;
    if (draft.scope === "ONE_MONTH" && (editing.scope !== "ONE_MONTH" || draft.month !== editing.startPeriod)) body.period = draft.month;
    if (draft.reason.trim() !== (editing.reason ?? "")) body.reason = draft.reason.trim();
    return body;
  }, [editing, draft, value]);
  const unchanged = !!patchBody && Object.keys(patchBody).length === 0;
  const missing = problem ?? (unchanged ? "O'zgarish yo'q" : null);

  const done = (message: string, invoices?: DiscountInvoiceResult) => {
    const extra = invoicesNote(invoices, tr);
    setToast({ type: "success", message: extra ? `${message} · ${extra}` : message });
    void invalidate();
    onClose();
  };
  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));

  const save = useMutation({
    mutationFn: () => {
      if (editing) return api.patch<DiscountMutationResult>(`/app/discounts/${editing.id}`, patchBody);
      return api.post<DiscountMutationResult>("/app/discounts", {
        childId,
        type: draft.type,
        scope: draft.scope,
        value,
        period: draft.scope === "ONE_MONTH" ? draft.month : undefined,
        reason: draft.reason.trim() || undefined,
      });
    },
    onSuccess: (res) => {
      const name = current?.fullName ?? "";
      const message = editing ? tr("Chegirma saqlandi") : res.replaced?.length ? tr("Chegirma almashtirildi") : tr("Chegirma berildi");
      done(name ? `${message} — ${name}` : message, res.invoices);
    },
    onError: fail,
  });

  const end = useMutation({
    mutationFn: (id: string) => api.delete<DiscountMutationResult>(`/app/discounts/${id}`),
    onSuccess: (res) => {
      const name = current?.fullName ?? "";
      done(name ? `${tr("Chegirma bekor qilindi")} — ${name}` : tr("Chegirma bekor qilindi"), res.invoices);
    },
    onError: fail,
  });

  const busy = save.isPending || end.isPending;

  const startEdit = (target: DiscountRow, from: "view" | "pick") => {
    const existing = target.rule && target.rule.isActive ? target.rule : null;
    // Ko'rishdan "Tahrirlash" — mavjud qoida; "Chegirma berish" / tanlash — yangi
    const edit = from === "view" && existing ? existing : null;
    setEditing(edit);
    setDraft(edit ? draftFromRule(edit, period) : newDraft(period));
    setShowErrors(false);
    setError(null);
    setEditFrom(from);
    setMode("edit");
  };

  const back = () => {
    if (busy) return;
    setError(null);
    if (mode === "confirm") setMode("view");
    else if (mode === "edit") setMode(editFrom);
    else onClose();
  };

  const submit = () => {
    if (missing) {
      setShowErrors(true);
      return;
    }
    setError(null);
    save.mutate();
  };

  let title: ReactNode = current?.fullName ?? "";
  let body: ReactNode = null;
  let footer: ReactNode = undefined;
  let cancelLabel = "Yopish";

  if (mode === "pick") {
    title = tr("Bolani tanlang");
    cancelLabel = "Bekor qilish";
    body = (
      <ChildPicker
        rows={rows}
        search={search}
        onSearch={setSearch}
        onPick={(r) => {
          setCurrent(r);
          startEdit(r, "pick");
        }}
      />
    );
  } else if (mode === "view" && current) {
    const history = (historyQuery.data?.history ?? []).filter((h) => h.id !== rule?.id);
    body = (
      <>
        <ChildHeader row={current} />
        <SheetSection title={periodLabel(period, tr)}>
          <SheetRow label={tr("Chegirmasiz")}>
            <span className="tabular-nums text-[var(--color-text)]">
              {groupDigits(current.gross)} {tr("so'm")}
            </span>
          </SheetRow>
          <SheetRow label={tr("Chegirma")}>
            {current.discount > 0 ? (
              <span className="inline-flex items-center justify-end gap-2">
                <Pill color={DISCOUNT_COLOR}>{Math.round(current.rate * 100)}%</Pill>
                <span className="tabular-nums" style={{ color: DISCOUNT_COLOR }}>
                  −{groupDigits(current.discount)} {tr("so'm")}
                </span>
              </span>
            ) : (
              tr("yo'q")
            )}
          </SheetRow>
          <SheetRow label={tr("To'laydi")}>
            <span className="text-[17px] font-bold tabular-nums text-[var(--color-text)]">
              {groupDigits(current.net)} {tr("so'm")}
            </span>
          </SheetRow>
        </SheetSection>

        {rule && (
          <SheetSection title={tr("Chegirma")}>
            <SheetRow label={tr("Turi")}>
              {tr(typeLabel(rule.type))} ·{" "}
              <span className="tabular-nums">
                {rule.type === "PERCENTAGE"
                  ? `${formatPercent(rule.value)}%`
                  : `${rule.type === "FIXED_AMOUNT" ? "−" : ""}${groupDigits(rule.value)} ${tr("so'm")}`}
              </span>
            </SheetRow>
            <SheetRow label={tr("Muddat")}>
              {rule.scope === "ONE_MONTH"
                ? `${tr(scopeLabel(rule.scope))} · ${periodLabel(rule.startPeriod, tr)}`
                : tr("Doimiy · {0} oyidan", periodLabel(rule.startPeriod, tr))}
            </SheetRow>
            {rule.reason && <SheetRow label={tr("Sabab")}>{rule.reason}</SheetRow>}
            {rule.createdByName && <SheetRow label={tr("Kim berdi")}>{rule.createdByName}</SheetRow>}
            {!rule.isActive && rule.endedAt && <SheetRow label={tr("To'xtatildi")}>{formatDate(rule.endedAt)}</SheetRow>}
          </SheetSection>
        )}

        {rule && !rule.isActive && (
          <Note tone="gray" icon={Info}>
            {tr("Bu chegirma keyinroq to'xtatilgan — tanlangan oyda amal qilgan, endi tahrirlanmaydi.")}
          </Note>
        )}
        {current.status === "REVIEW" && (
          <Note tone="orange" icon={TriangleAlert}>
            {tr("Katta chegirma (300 000 so'mdan ortiq) — to'g'riligini bir tekshirib qo'ying.")}
          </Note>
        )}
        {current.gross <= 0 && (
          <Note tone="orange" icon={TriangleAlert}>
            {tr("Bu bolaning oylik narxi belgilanmagan")}
          </Note>
        )}

        {history.length > 0 && (
          <section>
            <h3 className={SECTION_TITLE}>{tr("Tarix")}</h3>
            <div className={GROUP_BLOCK}>
              {history.map((h) => (
                <Row
                  key={h.id}
                  title={
                    <span className="tabular-nums">
                      {ruleLabel(h, tr)} ·{" "}
                      {h.scope === "ONE_MONTH" ? `${tr(scopeLabel(h.scope))} · ${periodLabel(h.startPeriod, tr)}` : tr("Doimiy · {0} oyidan", periodLabel(h.startPeriod, tr))}
                    </span>
                  }
                  subtitle={[h.createdByName, formatDate(h.createdAt), h.reason].filter(Boolean).join(" · ")}
                  value={h.isActive ? <Pill color={IOS.green}>{tr("faol")}</Pill> : <Pill color={IOS.gray}>{tr("tugagan")}</Pill>}
                />
              ))}
            </div>
          </section>
        )}

        {!current.invoiced && (
          <p className="px-4 text-[12.5px] leading-snug text-[#8e8e93]">
            {tr("Bu oy uchun hali hisob-faktura yo'q — hisob-faktura yaratilganda chegirma o'zi qo'llanadi.")}
          </p>
        )}
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{error}</p>}
      </>
    );
    if (canWrite && rule?.isActive) {
      footer = (
        <div className="flex gap-3">
          <div className="flex-1">
            <SheetSecondaryButton
              danger
              onClick={() => {
                setError(null);
                setMode("confirm");
              }}
            >
              {tr("Bekor qilish")}
            </SheetSecondaryButton>
          </div>
          <div className="flex-1">
            <SheetPrimaryButton onClick={() => startEdit(current, "view")}>{tr("Tahrirlash")}</SheetPrimaryButton>
          </div>
        </div>
      );
    } else if (canWrite && !rule) {
      footer = <SheetPrimaryButton onClick={() => startEdit(current, "view")}>{tr("Chegirma berish")}</SheetPrimaryButton>;
    }
  } else if (mode === "edit" && current) {
    title = editing ? tr("Chegirmani tahrirlash") : tr("Yangi chegirma");
    cancelLabel = "Orqaga";
    const existing = current.rule?.isActive ? current.rule : null;
    const willReplace =
      !editing && existing && existing.scope === draft.scope && (draft.scope === "PERMANENT" || existing.startPeriod === draft.month);
    body = (
      <>
        <ChildHeader row={current} compact />
        {willReplace && (
          <Note tone="orange" icon={TriangleAlert}>
            {tr("Bu bolada chegirma bor ({0}) — yangisi uni almashtiradi (eskisi tarixda qoladi).", ruleLabel(existing, tr))}
          </Note>
        )}
        <DiscountFormFields draft={draft} onChange={setDraft} gross={gross} currentPeriod={cur} showErrors={showErrors} />
        <DiscountPreview gross={gross} discount={previewDiscount} month={previewMonth} />
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{error}</p>}
      </>
    );
    footer = (
      <SheetPrimaryButton onClick={submit} loading={save.isPending} dim={!!missing}>
        {missing ? tr(missing) : editing ? tr("Saqlash") : tr("Chegirma berish")}
      </SheetPrimaryButton>
    );
  } else if (mode === "confirm" && current && rule) {
    title = tr("Chegirmani bekor qilish");
    cancelLabel = "Orqaga";
    const from = rule.startPeriod > cur ? rule.startPeriod : cur;
    body = (
      <>
        <ChildHeader row={current} />
        <div className="rounded-[18px] px-4 py-3.5 text-[14px] leading-snug" style={{ backgroundColor: "rgba(255,59,48,0.10)", color: "#d70015" }}>
          <p className="font-semibold">
            {ruleLabel(rule, tr)} · {tr(scopeLabel(rule.scope))}
          </p>
          <p className="mt-1">
            {rule.scope === "ONE_MONTH"
              ? tr("{0} oyi uchun chegirma olib tashlanadi.", periodLabel(rule.startPeriod, tr))
              : tr("{0} {1} oyidan boshlab to'liq narxni to'laydi — {2} so'm. O'tgan oylar o'zgarmaydi.", current.fullName, periodLabel(from, tr), groupDigits(current.gross))}
          </p>
          <p className="mt-1">{tr("Chegirma o'chirilmaydi — tarixda qoladi. To'langan oylar o'zgarmaydi.")}</p>
        </div>
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{error}</p>}
      </>
    );
    footer = (
      <div className="flex gap-3">
        <div className="flex-1">
          <SheetSecondaryButton onClick={back}>{tr("Qoldirish")}</SheetSecondaryButton>
        </div>
        <div className="flex-1">
          <button
            type="button"
            disabled={end.isPending}
            onClick={() => {
              setError(null);
              end.mutate(rule.id);
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
          >
            {end.isPending ? <Spinner className="h-5 w-5 text-white" /> : tr("Bekor qilish")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <IosSheet open={open} onClose={mode === "view" || mode === "pick" ? () => !busy && onClose() : back} title={title} cancelLabel={cancelLabel} footer={footer}>
        {body}
      </IosSheet>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}

/** Bola: avatar, ism, guruh · ID (· filial) */
function ChildHeader({ row, compact = false }: { row: DiscountRow; compact?: boolean }) {
  const tr = useTr();
  const subtitle = [row.groupName ? tr(row.groupName) : tr("Guruhsiz"), `id${row.publicId}`, row.branchName].filter(Boolean).join(" · ");
  if (compact) {
    return (
      <div className={clsx(GROUP_BLOCK, "flex items-center gap-3 px-4 py-3")}>
        <IosAvatar name={row.fullName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-medium text-[var(--color-text)]">{row.fullName}</p>
          <p className="truncate text-[13px] text-[#8e8e93]">{subtitle}</p>
        </div>
        <span className="shrink-0 text-right text-[13px] tabular-nums text-[#8e8e93]">
          {groupDigits(row.gross)} {tr("so'm")}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5 pt-1 text-center">
      <IosAvatar name={row.fullName} size={64} />
      <p className="max-w-full truncate text-[17px] font-semibold text-[var(--color-text)]">{row.fullName}</p>
      <p className="max-w-full truncate text-[13px] text-[#8e8e93]">{subtitle}</p>
    </div>
  );
}

/** Bola tanlash: qidiruv + ro'yxat (ism bo'yicha, 40 tagacha) */
function ChildPicker({ rows, search, onSearch, onPick }: { rows: DiscountRow[]; search: string; onSearch: (v: string) => void; onPick: (r: DiscountRow) => void }) {
  const tr = useTr();
  const list = useMemo(
    () =>
      rows
        .filter((r) => matchesSearch(r, search))
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .slice(0, PICKER_LIMIT),
    [rows, search],
  );
  return (
    <>
      <SearchPill value={search} onChange={onSearch} placeholder={tr("Ism, ID yoki guruh")} />
      <section>
        {list.length === 0 ? (
          <div className={clsx(GROUP_BLOCK, "flex flex-col items-center px-6 py-9 text-center")}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[#8e8e93]">
              <UsersRound className="h-7 w-7" strokeWidth={1.9} />
            </span>
            <p className="mt-3 text-[15px] font-semibold text-[var(--color-text)]">{tr("Topilmadi")}</p>
          </div>
        ) : (
          <div className={GROUP_BLOCK}>
            {list.map((r) => (
              <div key={r.childId} className="group/row relative">
                <button type="button" onClick={() => onPick(r)} className={clsx("flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS)}>
                  <IosAvatar name={r.fullName} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-[var(--color-text)]">{r.fullName}</span>
                    <span className="block truncate text-[12.5px] text-[#8e8e93]">
                      {[r.groupName ? tr(r.groupName) : tr("Guruhsiz"), `id${r.publicId}`].join(" · ")}
                    </span>
                  </span>
                  {r.rule && r.discount > 0 ? (
                    <Pill color={DISCOUNT_COLOR}>{ruleLabel(r.rule, tr)}</Pill>
                  ) : (
                    <span className="shrink-0 text-[13px] tabular-nums text-[#8e8e93]">{groupDigits(r.gross)}</span>
                  )}
                </button>
                <span className={ROW_SEPARATOR} style={{ left: 68 }} aria-hidden="true" />
              </div>
            ))}
          </div>
        )}
        {list.length === PICKER_LIMIT && <p className="px-4 pt-2 text-[12.5px] text-[#8e8e93]">{tr("Ko'proq natija bor — qidiruvni aniqlashtiring")}</p>}
      </section>
    </>
  );
}

