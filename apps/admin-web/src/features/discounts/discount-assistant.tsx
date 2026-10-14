"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, TriangleAlert, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { IosButton } from "@/components/ios/button";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { GROUP_BLOCK, IOS, ROW_PRESS, ROW_SEPARATOR, SECTION_TITLE } from "@/components/ios/tokens";
import { Toast, type ToastState } from "@/components/ui/toast";
import { groupDigits, periodLabel } from "@/features/payments/shared";
import { useTr } from "@/i18n/tr";
import { DiscountFormFields, Note, draftProblem, draftValue, invoicesNote, newDraft, useDiscountInvalidate, type DiscountDraft } from "./discount-sheet";
import { DISCOUNT_COLOR, computeDiscount, ruleLabel, type BulkDiscountResult, type DiscountFamily, type DiscountRow } from "./shared";

const PAGE = 6;
const DEFAULT_REASON = "Aka-uka / opa-singil";

/**
 * "Tez chegirma" — oila a'zolarini topib, bir nechta bolaga birdan
 * chegirma berish. Bir ota-onaga (telefon) bog'langanlar — aniq oila,
 * bir xil familiya — taxmin. Bolalar belgilanadi, pastda yopishqoq panel
 * va ommaviy varaq. Oila topilmasa karta umuman ko'rinmaydi.
 */
export function DiscountAssistant({
  slug,
  period,
  branchId,
  canWrite,
  currentPeriod,
}: {
  slug: string;
  period: string;
  branchId: string | null;
  canWrite: boolean;
  currentPeriod: string;
}) {
  const tr = useTr();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    setSelected(new Set());
    setShown(PAGE);
  }, [period, branchId]);

  const query = useQuery({
    queryKey: ["discount-suggestions", slug, period, branchId],
    queryFn: () =>
      api.get<{ period: string; families: DiscountFamily[] }>(`/app/discounts/suggestions?period=${period}${branchId ? `&branchId=${branchId}` : ""}`),
    enabled: !!period,
  });
  const families = useMemo(() => query.data?.families ?? [], [query.data]);

  // Tanlangan bolalar (bir bola bir nechta oilada bo'lishi mumkin)
  const selectedRows = useMemo(() => {
    const byId = new Map<string, DiscountRow>();
    for (const f of families) for (const c of f.children) if (selected.has(c.childId)) byId.set(c.childId, c);
    return [...byId.values()];
  }, [families, selected]);

  // Ma'lumot yangilanganda yo'qolgan bolalar tanlovdan chiqadi
  useEffect(() => {
    if (selectedRows.length !== selected.size) setSelected(new Set(selectedRows.map((r) => r.childId)));
  }, [selectedRows, selected.size]);

  if (!period || families.length === 0) return null;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleFamily = (f: DiscountFamily) => {
    const eligible = f.children.filter((c) => !(c.discount > 0));
    const allOn = eligible.length > 0 && eligible.every((c) => selected.has(c.childId));
    setSelected((s) => {
      const next = new Set(s);
      if (allOn) for (const c of f.children) next.delete(c.childId);
      else for (const c of eligible) next.add(c.childId);
      return next;
    });
  };

  return (
    <section className="relative">
      <h2 className={SECTION_TITLE}>{tr("Tez chegirma")}</h2>
      <p className="px-4 pb-3 text-[13px] leading-snug text-[#8e8e93]">
        {tr("Bir ota-onaga bog'langan bolalar — aniq oila; bir xil familiya — taxmin, begonalarni olib tashlang. Odatda chegirma ikkinchi farzanddan beriladi.")}
      </p>

      <div className="space-y-3">
        {families.slice(0, shown).map((f) => {
          const eligible = f.children.filter((c) => !(c.discount > 0));
          const allOn = eligible.length > 0 && eligible.every((c) => selected.has(c.childId));
          const anyOn = f.children.some((c) => selected.has(c.childId));
          return (
            <div key={f.key} className={GROUP_BLOCK}>
              <div className="flex min-h-[48px] items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-[var(--color-text)]">{f.label}</span>
                    {f.reason === "GUARDIAN" ? <Pill color={IOS.green}>{tr("ota-ona")}</Pill> : <Pill color={IOS.orange}>{tr("familiya")}</Pill>}
                  </div>
                  {f.phone && <p className="truncate text-[12.5px] tabular-nums text-[#8e8e93]">+998 {f.phone}</p>}
                </div>
                {canWrite && (eligible.length > 0 || anyOn) && (
                  <button
                    type="button"
                    onClick={() => toggleFamily(f)}
                    className="h-9 shrink-0 rounded-full px-3 text-[14px] font-medium text-[var(--color-primary)] transition-opacity active:opacity-50"
                  >
                    {allOn || (eligible.length === 0 && anyOn) ? tr("Bekor") : tr("Hammasi")}
                  </button>
                )}
              </div>
              {f.children.map((c) => {
                const checked = selected.has(c.childId);
                const content = (
                  <>
                    {canWrite ? (
                      <span
                        className={clsx(
                          "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition-colors",
                          checked ? "bg-[var(--color-primary)] text-white" : "ring-[1.5px] ring-inset ring-[#c7c7cc]",
                        )}
                        aria-hidden="true"
                      >
                        {checked && <Check className="h-4 w-4" strokeWidth={3} />}
                      </span>
                    ) : (
                      <IosAvatar name={c.fullName} size={32} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-[var(--color-text)]">{c.fullName}</span>
                      <span className="block truncate text-[12.5px] text-[#8e8e93]">
                        {[c.groupName ? tr(c.groupName) : tr("Guruhsiz"), `${groupDigits(c.net)} ${tr("so'm")}`].join(" · ")}
                      </span>
                    </span>
                    {c.rule && c.discount > 0 && <Pill color={DISCOUNT_COLOR}>{ruleLabel(c.rule, tr)}</Pill>}
                  </>
                );
                return (
                  <div key={c.childId} className="group/row relative">
                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.childId)}
                        aria-pressed={checked}
                        className={clsx("flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS)}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="flex min-h-[52px] items-center gap-3 px-4 py-2">{content}</div>
                    )}
                    <span className={ROW_SEPARATOR} style={{ left: canWrite ? 54 : 60 }} aria-hidden="true" />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {families.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-3 h-11 w-full rounded-full bg-[#767680]/[0.12] text-[15px] font-medium text-[var(--color-primary)] transition-transform active:scale-[0.98]"
        >
          {tr("Yana ko'rsatish")} · {families.length - shown}
        </button>
      )}

      {/* Yopishqoq panel — telefonda pastki menyu ustida */}
      {canWrite && selected.size > 0 && (
        <div className="sticky bottom-[calc(82px+env(safe-area-inset-bottom))] z-20 mt-3 md:bottom-4">
          <div className="flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-4 pr-1.5 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)] backdrop-blur">
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{tr("{0} ta tanlandi", selected.size)}</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label={tr("Tanlovni tozalash")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[#3c3c43] transition-transform active:scale-90"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <IosButton label={tr("Chegirma berish")} variant="primary" onClick={() => setBulkOpen(true)} />
          </div>
        </div>
      )}

      <BulkDiscountSheet
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        rows={selectedRows}
        period={period}
        currentPeriod={currentPeriod}
        onDone={() => setSelected(new Set())}
      />
    </section>
  );
}

/**
 * Ommaviy chegirma: bitta tur/qiymat/muddat tanlangan hamma bolaga.
 * Har bola bo'yicha natija oldindan ko'rinadi; chegirmasi borlar haqida
 * ogohlantiriladi (yangisi eskisini almashtiradi, eskisi tarixda qoladi).
 */
export function BulkDiscountSheet({
  open,
  onClose,
  rows,
  period,
  currentPeriod,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  rows: DiscountRow[];
  period: string;
  currentPeriod: string;
  onDone: () => void;
}) {
  const tr = useTr();
  const invalidate = useDiscountInvalidate();
  const [draft, setDraft] = useState<DiscountDraft>(() => newDraft(period, DEFAULT_REASON));
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(newDraft(period, tr(DEFAULT_REASON)));
    setShowErrors(false);
    setError(null);
  }, [open, period, tr]);

  const value = draftValue(draft);
  // Ogohlantirish uchun eng kichik oylik narx (summa undan katta bo'lsa)
  const minGross = rows.reduce((m, r) => (r.gross > 0 && r.gross < m ? r.gross : m), Infinity);
  const gross = Number.isFinite(minGross) ? minGross : 0;
  const withDiscount = rows.filter((r) => r.discount > 0).length;
  const previews = rows.map((r) => ({ row: r, discount: computeDiscount(draft.type, value, r.gross) }));
  const total = previews.reduce((s, p) => s + p.discount, 0);
  const problem = rows.length === 0 ? "Bola tanlanmagan" : draftProblem(draft, gross);

  const save = useMutation({
    mutationFn: () =>
      api.post<BulkDiscountResult>("/app/discounts/bulk", {
        childIds: rows.map((r) => r.childId),
        type: draft.type,
        scope: draft.scope,
        value,
        period: draft.scope === "ONE_MONTH" ? draft.month : undefined,
        reason: draft.reason.trim() || undefined,
      }),
    onSuccess: (res) => {
      const extra = invoicesNote(res.invoices, tr);
      const message = tr("{0} ta bolaga chegirma berildi", res.count);
      setToast({ type: "success", message: extra ? `${message} · ${extra}` : message });
      void invalidate();
      onDone();
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const submit = () => {
    if (problem) {
      setShowErrors(true);
      return;
    }
    setError(null);
    save.mutate();
  };

  const previewMonth = draft.scope === "ONE_MONTH" ? draft.month : period > currentPeriod ? period : currentPeriod;

  return (
    <>
      <IosSheet
        open={open}
        onClose={() => !save.isPending && onClose()}
        title={tr("Chegirma berish")}
        footer={
          <SheetPrimaryButton onClick={submit} loading={save.isPending} dim={!!problem}>
            {problem ? tr(problem) : tr("{0} tasiga berish", rows.length)}
          </SheetPrimaryButton>
        }
      >
        {withDiscount > 0 && (
          <Note tone="orange" icon={TriangleAlert}>
            {tr("{0} ta bolada chegirma bor — yangisi uni almashtiradi (eskisi tarixda qoladi).", withDiscount)}
          </Note>
        )}
        <DiscountFormFields draft={draft} onChange={setDraft} gross={gross} currentPeriod={currentPeriod} showErrors={showErrors} />

        <section>
          <div className="flex items-end justify-between gap-3 pr-4">
            <h3 className={SECTION_TITLE}>
              {tr("Natija")} · {periodLabel(previewMonth, tr)}
            </h3>
            {total > 0 && (
              <span className="pb-1.5 text-[15px] font-semibold tabular-nums" style={{ color: DISCOUNT_COLOR }}>
                −{groupDigits(total)}
              </span>
            )}
          </div>
          <div className={GROUP_BLOCK}>
            {previews.map(({ row, discount }) => (
              <div key={row.childId} className="group/row relative flex min-h-[52px] items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-[var(--color-text)]">{row.fullName}</span>
                  <span className="block truncate text-[12.5px] text-[#8e8e93]">
                    {row.groupName ? tr(row.groupName) : tr("Guruhsiz")}
                    {row.rule && row.discount > 0 ? ` · ${tr("hozir")} ${ruleLabel(row.rule, tr)}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  {value > 0 && row.gross > 0 && row.net !== row.gross - discount && (
                    <span className="text-[12px] tabular-nums text-[#8e8e93] line-through">{groupDigits(row.net)}</span>
                  )}
                  <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">
                    {row.gross > 0 ? groupDigits(value > 0 ? row.gross - discount : row.net) : "—"}
                  </span>
                </span>
                <span className={ROW_SEPARATOR} aria-hidden="true" />
              </div>
            ))}
          </div>
        </section>
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{error}</p>}
      </IosSheet>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
