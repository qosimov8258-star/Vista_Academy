"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowRightLeft, Check, TriangleAlert, UserMinus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Group } from "@/lib/types";
import { currentMonth } from "@/features/cash/shared";
import { groupDigits, type PeriodChild } from "@/features/payments/shared";
import { ChipRow, IosChip, SearchPill } from "@/components/ios/filters";
import { Segmented } from "@/components/ios/form";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { SkeletonRows } from "@/components/ios/states";
import { IOS, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

type Tab = "in" | "add";

/**
 * O'quvchilarni boshqarish: guruhdagi bolalar (bosilsa — chiqarish yoki
 * boshqa guruhga o'tkazish; qarzi bo'lsa avval ogohlantiriladi) va
 * qo'shish (filialdagi boshqa bolalar, bir nechtasini birdan tanlash;
 * sig'im oshsa ogohlantiriladi). Bolalar va ularning qarzi bitta so'rovda
 * (`/app/cash/children`) olinadi.
 */
export function ManageChildrenSheet({ open, onClose, slug, group }: { open: boolean; onClose: () => void; slug: string; group: Group | null }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("in");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<PeriodChild | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [period, setPeriod] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("in");
    setSearch("");
    setSelected(new Set());
    setRemoving(null);
    setError(null);
    setDone(null);
    setPeriod(currentMonth());
  }, [open]);

  const childrenQuery = useQuery({
    queryKey: ["pay-children", slug, period],
    queryFn: () => api.get<{ children: PeriodChild[] }>(`/app/cash/children?period=${period}`),
    enabled: open && !!period,
  });
  const groupsQuery = useQuery({
    queryKey: ["groups", slug, null],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });

  const all = useMemo(() => childrenQuery.data?.children ?? [], [childrenQuery.data]);
  const inGroup = all.filter((c) => c.groupId === group?.id);
  const others = all.filter((c) => c.groupId !== group?.id);
  const q = search.trim().toLowerCase();
  const match = (c: PeriodChild) => !q || c.childName.toLowerCase().includes(q) || String(c.publicId ?? "").includes(q);
  const otherGroups = (groupsQuery.data ?? []).filter((g) => g.id !== group?.id && g.status === "ACTIVE" && g.branchId === group?.branchId);
  const capacity = group?.capacity ?? 0;
  const afterAdd = inGroup.length + selected.size;

  const invalidate = () => {
    for (const key of [["group-overview", slug, group?.id], ["groups", slug], ["group-day", slug, group?.id], ["group-attendance-range", slug, group?.id], ["pay-children", slug], ["children", slug], ["attendance", slug]]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const moveMutation = useMutation({
    mutationFn: async ({ ids, groupId }: { ids: string[]; groupId: string | null }) => {
      for (const id of ids) await api.patch(`/app/children/${id}`, { groupId });
      return ids.length;
    },
    onSuccess: (n, { groupId }) => {
      setError(null);
      invalidate();
      if (groupId === group?.id) {
        setDone(tr("{0} ta bola guruhga qo'shildi", n));
        setSelected(new Set());
        setTab("in");
      } else {
        setDone(groupId ? tr("Bola boshqa guruhga o'tkazildi") : tr("Bola guruhdan chiqarildi"));
        setRemoving(null);
      }
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const groupLabel = (c: PeriodChild) => (c.groupName ? tr("hozir: {0}", c.groupName) : tr("guruhsiz"));

  // --- 2-bosqich: chiqarishni tasdiqlash ---
  if (removing) {
    const debt = removing.totalDebt;
    const targetGroup = otherGroups.find((g) => g.id === target);
    return (
      <IosSheet
        open={open}
        onClose={() => !moveMutation.isPending && setRemoving(null)}
        title={tr("Guruhdan chiqarish")}
        cancelLabel="Orqaga"
        footer={
          <div className="space-y-2.5">
            {targetGroup ? (
              <SheetPrimaryButton loading={moveMutation.isPending} onClick={() => moveMutation.mutate({ ids: [removing.childId], groupId: target })}>
                {tr("«{0}» guruhiga o'tkazish", targetGroup.name)}
              </SheetPrimaryButton>
            ) : (
              // Guruhsiz qoldirish — xavfli amal, qizil
              <button
                type="button"
                disabled={moveMutation.isPending}
                onClick={() => moveMutation.mutate({ ids: [removing.childId], groupId: null })}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-transform active:scale-[0.96] disabled:opacity-60"
              >
                {moveMutation.isPending ? <Spinner className="h-5 w-5 text-white" /> : <UserMinus className="h-[18px] w-[18px]" strokeWidth={2.4} />}
                {tr("Guruhdan chiqarish")}
              </button>
            )}
            <SheetSecondaryButton onClick={() => setRemoving(null)}>{tr("Qoldirish")}</SheetSecondaryButton>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <IosAvatar name={removing.childName} size={64} />
          <p className="text-[17px] font-semibold text-[var(--color-text)]">{tr(removing.childName)}</p>
          <p className="text-[13px] text-[#8e8e93]">{[removing.publicId ? `ID ${removing.publicId}` : null, group?.name].filter(Boolean).join(" · ")}</p>
        </div>

        {debt > 0.5 ? (
          <div className="flex items-start gap-3 rounded-[16px] bg-[#ff3b30]/[0.1] px-4 py-3.5" role="alert">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#ff3b30]" strokeWidth={2.2} />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[#ff3b30]">
                {tr("To'lanmagan qarz: {0} so'm", groupDigits(debt))}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-text)]">
                {tr("Bolani guruhdan chiqarsangiz ham qarz o'chmaydi — moliyada bolaning nomida qoladi. Avval qarzni yopish tavsiya etiladi.")}
              </p>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-[16px] bg-[#34c759]/[0.1] px-4 py-3 text-[14px] text-[var(--color-text)]">
            <Check className="h-5 w-5 shrink-0 text-[#34c759]" strokeWidth={2.4} />
            {tr("To'lov bo'yicha qarzi yo'q")}
          </p>
        )}

        <SheetSection title={tr("Qayerga")} footer={target ? tr("Bola tanlangan guruhga o'tadi.") : tr("Bola guruhsiz qoladi — keyin istalgan guruhga qo'shsa bo'ladi.")}>
          <div className="p-3">
            <ChipRow label={tr("Qayerga")}>
              <IosChip active={target === null} onClick={() => setTarget(null)}>
                {tr("Guruhsiz")}
              </IosChip>
              {otherGroups.map((g) => (
                <IosChip key={g.id} active={target === g.id} onClick={() => setTarget(g.id)} count={g._count?.children}>
                  {tr(g.name)}
                </IosChip>
              ))}
            </ChipRow>
          </div>
        </SheetSection>
        {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
      </IosSheet>
    );
  }

  // --- Asosiy ko'rinish ---
  const rows = (tab === "in" ? inGroup : others).filter(match).sort((a, b) => a.childName.localeCompare(b.childName));
  return (
    <IosSheet
      open={open}
      onClose={onClose}
      title={group ? tr("O'quvchilar — {0}", group.name) : ""}
      cancelLabel="Yopish"
      footer={
        tab === "add" && selected.size > 0 ? (
          <SheetPrimaryButton loading={moveMutation.isPending} onClick={() => moveMutation.mutate({ ids: [...selected], groupId: group!.id })}>
            {tr("Guruhga qo'shish ({0})", selected.size)}
          </SheetPrimaryButton>
        ) : undefined
      }
    >
      <Segmented<Tab>
        value={tab}
        onChange={(t) => {
          setTab(t);
          setSearch("");
          setDone(null);
        }}
        label={tr("Bo'lim")}
        options={[
          { value: "in", label: tr("Guruhda · {0}", inGroup.length) },
          { value: "add", label: tr("Qo'shish") },
        ]}
      />
      <SearchPill value={search} onChange={setSearch} placeholder={tr("Bola ismi yoki ID")} />

      {done && (
        <p className="flex items-center gap-2 rounded-[14px] bg-[#34c759]/[0.1] px-4 py-2.5 text-[14px] font-medium text-[var(--color-text)]">
          <Check className="h-4 w-4 shrink-0 text-[#34c759]" strokeWidth={2.6} />
          {done}
        </p>
      )}
      {tab === "add" && selected.size > 0 && afterAdd > capacity && (
        <p className="flex items-start gap-2 rounded-[14px] bg-[#ff9500]/[0.12] px-4 py-2.5 text-[13px] leading-snug text-[var(--color-text)]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9500]" strokeWidth={2.4} />
          {tr("Sig'im oshadi: {0} / {1}. Guruh sig'imini tahrirlashda oshirish mumkin.", afterAdd, capacity)}
        </p>
      )}
      {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}

      <SheetSection
        footer={
          tab === "in"
            ? tr("Bolani bosing — guruhdan chiqarish yoki boshqa guruhga o'tkazish.")
            : tr("Boshqa guruhdagi bola tanlansa, u shu guruhga o'tadi.")
        }
      >
        {childrenQuery.isLoading || !period ? (
          <SkeletonRows rows={4} />
        ) : childrenQuery.isError ? (
          <p className="px-4 py-8 text-center text-[14px] text-[#ff3b30]">{tr((childrenQuery.error as Error).message)}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[14px] text-[#8e8e93]">
            {q ? tr("Bola topilmadi") : tab === "in" ? tr("Guruhda hali bola yo'q — «Qo'shish»dan qo'shing") : tr("Qo'shish uchun bola yo'q")}
          </p>
        ) : (
          rows.map((c) => {
            const debt = c.totalDebt > 0.5;
            const checked = selected.has(c.childId);
            return (
              <div key={c.childId} className="group/row relative">
                <button
                  type="button"
                  onClick={() => {
                    setDone(null);
                    if (tab === "in") {
                      setTarget(null);
                      setRemoving(c);
                    } else toggle(c.childId);
                  }}
                  aria-pressed={tab === "add" ? checked : undefined}
                  className={clsx("flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS)}
                >
                  <IosAvatar name={c.childName} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-[var(--color-text)]">{tr(c.childName)}</span>
                    <span className="block truncate text-[12.5px] text-[#8e8e93]">
                      {[c.publicId ? `ID ${c.publicId}` : null, tab === "add" ? groupLabel(c) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {debt && <Pill color={IOS.red}>−{groupDigits(c.totalDebt)}</Pill>}
                  {tab === "in" ? (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[#8e8e93]" aria-hidden="true">
                      {otherGroups.length ? <ArrowRightLeft className="h-4 w-4" strokeWidth={2.2} /> : <UserMinus className="h-4 w-4" strokeWidth={2.2} />}
                    </span>
                  ) : (
                    <span
                      className={clsx(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                        checked ? "bg-[var(--color-primary)] text-white" : "ring-[1.5px] ring-inset ring-[#c7c7cc]",
                      )}
                      aria-hidden="true"
                    >
                      {checked && <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                  )}
                </button>
                <span className={ROW_SEPARATOR} style={{ left: 68 }} aria-hidden="true" />
              </div>
            );
          })
        )}
      </SheetSection>
    </IosSheet>
  );
}
