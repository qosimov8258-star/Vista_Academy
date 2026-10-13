"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { BellRing, CalendarClock, CalendarX2, CircleCheck, MessageSquareText, Minus, Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney } from "@/lib/permissions";
import type { PaymentReminderSettings, UnpaidReminderChild } from "@/lib/types";
import { IosButton } from "@/components/ios/button";
import { dayMonthLabel } from "@/components/ios/day-stepper";
import { ChipRow, IosChip } from "@/components/ios/filters";
import { IosSwitch } from "@/components/ios/form";
import { Group, ListRow, Row } from "@/components/ios/group";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, SECTION_TITLE } from "@/components/ios/tokens";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { IosIcon } from "@/features/director/ios-icon";
import { PaymentSheet, type PaymentSheetChild } from "@/features/payments/payment-sheet";
import { groupDigits } from "@/features/payments/shared";
import { useTr } from "@/i18n/tr";

const DEFAULT_MESSAGE =
  "Hurmatli ota-ona! {childName} uchun to'lov muddati {dueDate}. Iltimos, to'lovni amalga oshiring.";
const MAX_TIMES = 6;
const MAX_DAYS = 60;

interface FormState {
  isEnabled: boolean;
  daysBeforeDue: number;
  daysAfterDue: number;
  sendTimes: string[];
  messageTemplate: string;
}

type Filter = "all" | "soon" | "overdue";

/** Matnga qo'yiladigan o'rin bosuvchilar — server ularni bolaning ma'lumoti bilan almashtiradi */
const PLACEHOLDERS = [
  { token: "{childName}", label: "Bola ismi" },
  { token: "{amount}", label: "Summa" },
  { token: "{dueDate}", label: "Muddat" },
  { token: "{daysLeft}", label: "Qolgan kun" },
] as const;

/**
 * Ro'yxatda avval muddati yaqinlashayotganlar (eng yaqin muddat tepada),
 * so'ng — bo'lsa — muddati o'tib ketganlar eng pastda ko'rinsin.
 */
function sortForReminderCard(rows: UnpaidReminderChild[]): UnpaidReminderChild[] {
  return [...rows].sort((a, b) => {
    const aOverdue = a.daysUntilDue < 0;
    const bOverdue = b.daysUntilDue < 0;
    if (aOverdue !== bOverdue) return aOverdue ? 1 : -1;
    return aOverdue ? b.daysUntilDue - a.daysUntilDue : a.daysUntilDue - b.daysUntilDue;
  });
}

/** Server bilan bir xil: summa xonalarga ajratilgan, sana dd.mm.yyyy */
function renderPreview(template: string, row: UnpaidReminderChild | undefined) {
  const due = row ? row.dueDate.slice(0, 10) : "2026-10-10";
  const [y, m, d] = due.split("-");
  return template
    .replace(/\{childName\}/g, row?.childFullName ?? "Aliyev Ali")
    .replace(/\{amount\}/g, groupDigits(row ? Number(row.remainingAmount) : 1500000))
    .replace(/\{dueDate\}/g, `${d}.${m}.${y}`)
    .replace(/\{daysLeft\}/g, String(row?.daysUntilDue ?? 3));
}

/** − 3 kun + : kun sonini tanlash (iOS stepper) */
function DaysStepper({ value, onChange, disabled, label }: { value: number; onChange: (v: number) => void; disabled?: boolean; label: string }) {
  const tr = useTr();
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text)] transition-[transform,background-color] active:scale-90 enabled:hover:bg-white disabled:opacity-30";
  return (
    <div className="flex items-center rounded-full bg-[#767680]/[0.12] p-[3px]" role="group" aria-label={label}>
      <button type="button" className={btn} disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} aria-label={tr("Kamaytirish")}>
        <Minus className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <span className="min-w-[58px] text-center text-[15px] font-semibold tabular-nums text-[var(--color-text)]" aria-live="polite">
        {tr("{0} kun", value)}
      </span>
      <button type="button" className={btn} disabled={disabled || value >= MAX_DAYS} onClick={() => onChange(value + 1)} aria-label={tr("Ko'paytirish")}>
        <Plus className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </div>
  );
}

/**
 * Eslatmalar — iOS uslubida: tepada holat (yoqilgan, muddati yaqin va
 * kechikkan bolalar soni, jami qoldiq), so'ng sozlamalar (yoqish, necha kun
 * oldin/keyin, yuborish vaqtlari, xabar matni va ota-ona ko'radigan
 * ko'rinishi), pastda hozir eslatma oynasiga tushayotgan bolalar — bosilsa
 * to'lov qabul qilish varag'i ochiladi.
 */
export default function RemindersPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  // URL filial nomi bilan ochilgan bo'lsa (masalan filial admini) shu majburiy;
  // aks holda (moliyachi/Super Admin umumiy `/[slug]/reminders`da) o'zi tanlaydi —
  // aks holda backend "branchId ko'rsatilishi shart" deb rad etadi.
  const { branchId: forcedBranchId, branches } = useBranchContext(slug);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const branchId = forcedBranchId ?? selectedBranchId ?? branches[0]?.id ?? null;
  const queryClient = useQueryClient();

  const qs = branchId ? `?branchId=${branchId}` : "";

  const settingsQuery = useQuery({
    queryKey: ["reminder-settings", slug, branchId],
    queryFn: () => api.get<PaymentReminderSettings>(`/app/finance/reminder-settings${qs}`),
    enabled: branchId !== null,
  });

  const unpaidQuery = useQuery({
    queryKey: ["reminder-unpaid-children", slug, branchId],
    queryFn: () => api.get<UnpaidReminderChild[]>(`/app/finance/reminder-settings/unpaid-children${qs}`),
    enabled: branchId !== null,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [saved, setSaved] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [payChild, setPayChild] = useState<PaymentSheetChild | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  /** Matn maydonidagi oxirgi kursor o'rni — tugma bosilganda fokus maydondan ketadi */
  const cursorRef = useRef<{ start: number; end: number } | null>(null);
  const rememberCursor = (el: HTMLTextAreaElement) => {
    cursorRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  // Filial almashsa — forma yangi filial sozlamasi bilan qayta to'ldiriladi
  useEffect(() => {
    setForm(null);
    setInitial(null);
    setFilter("all");
    cursorRef.current = null;
  }, [branchId]);

  // Server javobi kelgach formani bir marta to'ldiramiz — keyingi refetch'lar
  // (masalan saqlashdan keyingi invalidate) foydalanuvchi terayotgan qiymatni bosib ketmasin.
  useEffect(() => {
    if (settingsQuery.data && !form) {
      const next = {
        isEnabled: settingsQuery.data.isEnabled,
        daysBeforeDue: settingsQuery.data.daysBeforeDue,
        daysAfterDue: settingsQuery.data.daysAfterDue,
        sendTimes: settingsQuery.data.sendTimes.length > 0 ? settingsQuery.data.sendTimes : ["09:00"],
        messageTemplate: settingsQuery.data.messageTemplate || DEFAULT_MESSAGE,
      };
      setForm(next);
      setInitial(next);
    }
  }, [settingsQuery.data, form]);

  const dirty = !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial);

  const saveMutation = useMutation({
    mutationFn: (data: FormState) => api.put<PaymentReminderSettings>(`/app/finance/reminder-settings${qs}`, data),
    onSuccess: (data, sent) => {
      queryClient.setQueryData(["reminder-settings", slug, branchId], data);
      setInitial(sent);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Necha kun oldin/keyin o'zgarsa — eslatma oynasidagi bolalar ham o'zgaradi
      void queryClient.invalidateQueries({ queryKey: ["reminder-unpaid-children", slug, branchId] });
    },
  });

  const rows = useMemo(() => (unpaidQuery.data ? sortForReminderCard(unpaidQuery.data) : []), [unpaidQuery.data]);
  const soon = rows.filter((r) => r.daysUntilDue >= 0);
  const overdue = rows.filter((r) => r.daysUntilDue < 0);
  const visibleRows = filter === "soon" ? soon : filter === "overdue" ? overdue : rows;
  const totalRemaining = rows.reduce((s, r) => s + Number(r.remainingAmount), 0);

  const set = (patch: Partial<FormState>) => form && setForm({ ...form, ...patch });

  const insertPlaceholder = (token: string) => {
    if (!form) return;
    const el = messageRef.current;
    // Maydon tanlanmagan bo'lsa (kursor sukut bo'yicha boshida) — matn oxiriga
    const focused = !!el && cursorRef.current !== null;
    const len = form.messageTemplate.length;
    const start = focused ? Math.min(cursorRef.current!.start, len) : len;
    const end = focused ? Math.min(cursorRef.current!.end, len) : start;
    const before = form.messageTemplate.slice(0, start);
    const insert = !focused && before && !/\s$/.test(before) ? ` ${token}` : token;
    const text = `${before}${insert}${form.messageTemplate.slice(end)}`.slice(0, 1000);
    const caret = start + insert.length;
    set({ messageTemplate: text });
    cursorRef.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const settingsLoading = settingsQuery.isLoading || (!!settingsQuery.data && !form);

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={() => Promise.all([settingsQuery.refetch(), unpaidQuery.refetch()])} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={BellRing}
          tint="orange"
          title={tr("Eslatmalar")}
          count={unpaidQuery.data ? tr("{0} ta bola", rows.length) : undefined}
          subtitle={tr("To'lov muddati yaqinlashganda ota-ona kabinetida chiqadigan eslatma")}
        />

        {/* URL filial nomi bilan qulflanmagan (moliyachi/Super Admin) bo'lsa, filial o'zi tanlansin */}
        {!forcedBranchId && branches.length > 1 && (
          <ChipRow label={tr("Filial")}>
            {branches.map((b) => (
              <IosChip key={b.id} active={b.id === branchId} onClick={() => setSelectedBranchId(b.id)}>
                {tr(b.name)}
              </IosChip>
            ))}
          </ChipRow>
        )}

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        {!branchId ? (
          <EmptyState icon={BellRing} title="Filial yo'q" hint="Eslatmalar ko'rinishi uchun avval filial oching" />
        ) : (
          <>
            <StatStrip tone="white">
              <StatCell
                label={tr("Eslatma")}
                value={form ? (form.isEnabled ? tr("Yoqilgan") : tr("O'chiq")) : "—"}
                color={form?.isEnabled ? IOS.green : IOS.gray}
                hint={initial ? tr("{0} kun oldin · {1} kun keyin", initial.daysBeforeDue, initial.daysAfterDue) : undefined}
                loading={settingsLoading}
              />
              <StatCell label={tr("Muddati yaqin")} value={unpaidQuery.isError ? "—" : soon.length} color={soon.length ? IOS.orange : undefined} hint={tr("bola")} loading={unpaidQuery.isLoading} />
              <StatCell label={tr("Kechikkan")} value={unpaidQuery.isError ? "—" : overdue.length} color={overdue.length ? IOS.red : undefined} hint={tr("bola")} loading={unpaidQuery.isLoading} />
              <StatCell label={tr("Jami qoldiq")} value={unpaidQuery.isError ? "—" : groupDigits(totalRemaining)} hint={tr("so'm")} loading={unpaidQuery.isLoading} />
            </StatStrip>

            {settingsQuery.isError ? (
              <ErrorState message={(settingsQuery.error as Error).message} onRetry={() => settingsQuery.refetch()} retrying={settingsQuery.isFetching} />
            ) : settingsLoading || !form ? (
              <Group title={tr("Sozlamalar")} bare>
                <SkeletonRows rows={3} avatar={false} />
              </Group>
            ) : (
              <>
                <Group title={tr("Sozlamalar")} footer={tr("Karta muddatdan shuncha kun oldin chiqa boshlaydi va muddat o'tgach yana shuncha kun «kechikdi» deb turadi; to'lov qilingach o'zi yo'qoladi.")}>
                  <Row
                    leading={<IosIcon icon={BellRing} tint="green" size={30} />}
                    title={tr("Eslatma yoqilgan")}
                    subtitle={tr("O'chirilsa, ota-ona kabinetida karta chiqmaydi")}
                    value={
                      canWrite ? (
                        <IosSwitch checked={form.isEnabled} onChange={(v) => set({ isEnabled: v })} label={tr("Eslatma yoqilgan")} />
                      ) : (
                        <Pill color={form.isEnabled ? IOS.green : IOS.gray}>{form.isEnabled ? tr("Yoqilgan") : tr("O'chiq")}</Pill>
                      )
                    }
                  />
                  <Row
                    leading={<IosIcon icon={CalendarClock} tint="orange" size={30} />}
                    title={tr("Muddatdan oldin")}
                    value={<DaysStepper value={form.daysBeforeDue} onChange={(v) => set({ daysBeforeDue: v })} disabled={!canWrite} label={tr("Muddatdan oldin")} />}
                  />
                  <Row
                    leading={<IosIcon icon={CalendarX2} tint="red" size={30} />}
                    title={tr("Muddatdan keyin")}
                    value={<DaysStepper value={form.daysAfterDue} onChange={(v) => set({ daysAfterDue: v })} disabled={!canWrite} label={tr("Muddatdan keyin")} />}
                  />
                </Group>

                <section>
                  <h3 className={SECTION_TITLE}>{tr("Yuborish vaqti")}</h3>
                  <div className={clsx(GROUP_BLOCK, "flex flex-wrap items-center gap-2 p-4")}>
                    {form.sendTimes.map((t, i) => (
                      <span key={i} className="inline-flex h-10 items-center gap-1 rounded-full bg-[#767680]/[0.12] pl-3.5 pr-1.5">
                        <input
                          type="time"
                          value={t}
                          disabled={!canWrite}
                          aria-label={tr("Yuborish vaqti")}
                          onChange={(e) => set({ sendTimes: form.sendTimes.map((x, j) => (j === i ? e.target.value : x)) })}
                          className="bg-transparent text-[15px] font-semibold tabular-nums text-[var(--color-text)] outline-none disabled:opacity-100"
                        />
                        {canWrite && form.sendTimes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => set({ sendTimes: form.sendTimes.filter((_, j) => j !== i) })}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[#8e8e93] transition-colors hover:bg-white hover:text-[#ff3b30]"
                            aria-label={tr("O'chirish")}
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2.6} />
                          </button>
                        )}
                      </span>
                    ))}
                    {canWrite && form.sendTimes.length < MAX_TIMES && (
                      <button
                        type="button"
                        onClick={() => set({ sendTimes: [...form.sendTimes, "09:00"] })}
                        className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[15px] font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/[0.08] active:scale-[0.97]"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.4} />
                        {tr("Vaqt qo'shish")}
                      </button>
                    )}
                  </div>
                  <p className="px-4 pt-2 text-[12.5px] leading-snug text-[#8e8e93]">{tr("Kuniga {0} martagacha. Ota-onaga shu soatlarda bildirishnoma yuboriladi.", MAX_TIMES)}</p>
                </section>

                <section>
                  <h3 className={SECTION_TITLE}>{tr("Xabar matni")}</h3>
                  <div className={GROUP_BLOCK}>
                    <textarea
                      ref={messageRef}
                      rows={3}
                      maxLength={1000}
                      value={form.messageTemplate}
                      disabled={!canWrite}
                      onChange={(e) => {
                        set({ messageTemplate: e.target.value });
                        rememberCursor(e.target);
                      }}
                      onSelect={(e) => rememberCursor(e.currentTarget)}
                      aria-label={tr("Xabar matni")}
                      className="block w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed text-[var(--color-text)] outline-none disabled:opacity-100"
                    />
                    <div className="flex items-center justify-between gap-3 px-4 pb-3">
                      {canWrite ? (
                        <div className="flex min-w-0 flex-wrap gap-1.5">
                          {PLACEHOLDERS.map((p) => (
                            <button
                              key={p.token}
                              type="button"
                              onClick={() => insertPlaceholder(p.token)}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--color-primary)]/[0.1] px-3 text-[13px] font-medium text-[var(--color-primary)] transition-transform active:scale-95"
                            >
                              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                              {tr(p.label)}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span />
                      )}
                      <span className="shrink-0 text-[12px] tabular-nums text-[#8e8e93]">{form.messageTemplate.length}/1000</span>
                    </div>
                  </div>
                  <p className="px-4 pt-2 text-[12.5px] leading-snug text-[#8e8e93]">{tr("Tugma bosilsa, kursor turgan joyga bolaning ma'lumoti qo'yiladi.")}</p>
                </section>

                <section>
                  <h3 className={SECTION_TITLE}>{tr("Ota-ona ko'radi")}</h3>
                  <PageCard className="flex items-start gap-3 px-4 py-4">
                    <IosIcon icon={MessageSquareText} tint={form.isEnabled ? "orange" : "gray"} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[var(--color-text)]">{tr("To'lov eslatmasi")}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[var(--color-text)]">{renderPreview(form.messageTemplate, rows[0])}</p>
                      {!form.isEnabled && <p className="mt-1.5 text-[12.5px] text-[#8e8e93]">{tr("Eslatma o'chiq — ota-onaga ko'rinmaydi")}</p>}
                    </div>
                  </PageCard>
                </section>

                {canWrite && (
                  <div className="space-y-2">
                    {saveMutation.isError && (
                      <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
                        {saveMutation.error instanceof ApiError ? tr(saveMutation.error.message) : tr("Saqlab bo'lmadi")}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {dirty && (
                        <IosButton label={tr("Bekor qilish")} onClick={() => initial && setForm(initial)} disabled={saveMutation.isPending} />
                      )}
                      <IosButton
                        label={saved && !dirty ? tr("Saqlandi") : tr("Saqlash")}
                        icon={saved && !dirty ? CircleCheck : undefined}
                        variant="primary"
                        className="flex-1"
                        loading={saveMutation.isPending}
                        disabled={!dirty}
                        onClick={() => saveMutation.mutate(form)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Sozlamalardan qat'i nazar — muddati yaqinlashgan/o'tib ketgan o'quvchilar shu yerga o'zi qo'shiladi */}
            <section className="space-y-3">
              {rows.length > 0 && (
                <ChipRow label={tr("Holat")}>
                  <IosChip active={filter === "all"} onClick={() => setFilter("all")} count={rows.length}>
                    {tr("Hammasi")}
                  </IosChip>
                  <IosChip active={filter === "soon"} onClick={() => setFilter("soon")} count={soon.length}>
                    {tr("Muddati yaqin")}
                  </IosChip>
                  <IosChip active={filter === "overdue"} onClick={() => setFilter("overdue")} count={overdue.length}>
                    {tr("Kechikkan")}
                  </IosChip>
                </ChipRow>
              )}
              {unpaidQuery.isLoading ? (
                <Group title={tr("Eslatma oynasidagi bolalar")} bare>
                  <SkeletonRows rows={4} />
                </Group>
              ) : unpaidQuery.isError ? (
                <ErrorState message={(unpaidQuery.error as Error).message} onRetry={() => unpaidQuery.refetch()} retrying={unpaidQuery.isFetching} />
              ) : rows.length === 0 ? (
                <Group title={tr("Eslatma oynasidagi bolalar")} bare>
                  <EmptyState icon={CircleCheck} title="Hozircha hech kim yo'q" hint="Barcha o'quvchilar to'lovini amalga oshirgan" />
                </Group>
              ) : (
                <Group
                  title={tr("Eslatma oynasidagi bolalar")}
                  refreshing={unpaidQuery.isFetching}
                  footer={canWrite ? tr("Bolani bosing — to'lov qabul qilish oynasi ochiladi.") : undefined}
                >
                  {visibleRows.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[14px] text-[#8e8e93]">{tr("Bu holatda bola yo'q")}</p>
                  ) : (
                    visibleRows.map((row) => {
                      const late = row.daysUntilDue < 0;
                      return (
                        <ListRow
                          key={row.invoiceId}
                          onClick={canWrite ? () => setPayChild({ id: row.childId, name: row.childFullName }) : undefined}
                          avatar={<IosAvatar name={row.childFullName} size={44} />}
                          title={tr(row.childFullName)}
                          subtitle={[row.groupName, tr("muddat {0}", dayMonthLabel(row.dueDate.slice(0, 10), tr))].filter(Boolean).join(" · ")}
                          meta={
                            <span className="flex flex-col items-end gap-1">
                              <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text)]">{groupDigits(row.remainingAmount)}</span>
                              <Pill color={late ? IOS.red : IOS.orange}>
                                {late
                                  ? tr("{0} kun kechikdi", Math.abs(row.daysUntilDue))
                                  : row.daysUntilDue === 0
                                    ? tr("Bugun")
                                    : tr("{0} kun qoldi", row.daysUntilDue)}
                              </Pill>
                            </span>
                          }
                        />
                      );
                    })
                  )}
                </Group>
              )}
            </section>
          </>
        )}
      </div>

      <PaymentSheet
        slug={slug}
        child={payChild}
        onClose={() => {
          setPayChild(null);
          void queryClient.invalidateQueries({ queryKey: ["reminder-unpaid-children", slug, branchId] });
        }}
      />
    </div>
  );
}
