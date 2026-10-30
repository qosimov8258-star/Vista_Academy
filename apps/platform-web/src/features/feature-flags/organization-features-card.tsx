"use client";

import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { OrganizationFeatures } from "@/lib/types";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { Switch } from "./switch";
import { groupFeatures, useFeatureCatalog } from "./use-feature-catalog";

/**
 * Ko'rinishdagi guruhlash (API'ga ta'sir qilmaydi): "ichki" funksiya asosiy
 * qator ichida, bosilganda ochiladigan blokda chiqadi.
 */
const NESTED_UNDER: Record<string, string> = {
  childAvatar: "childCreate",
  childFieldBirthDate: "childCreate",
  childFieldGender: "childCreate",
  childFieldGuardianPassword: "childCreate",
  employeeAvatar: "employeeCreate",
  employeeAccount: "employeeCreate",
  employeeGroups: "employeeCreate",
};
const NESTED_HINT: Record<string, string> = {
  childCreate: "Bu sozlamalar bola qo'shishda ham, bolani tahrirlashda ham amal qiladi.",
  employeeCreate: "Bu sozlamalar xodim qo'shishda ham, xodim kartochkasida ham amal qiladi.",
};

/** "Bola formasi: tug'ilgan sana" → "Tug'ilgan sana" (sarlavhada qaysi forma ekani allaqachon ko'rinib turadi) */
const shortLabel = (label: string) => {
  const text = label.replace(/^[^:]+forma[^:]*:\s*/i, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const card = "rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

/**
 * Bog'cha sahifasidagi "Funksiyalar": har bir funksiya — oddiy yoqish/o'chirish
 * tugmasi. Qiymat qayerdan kelayotgani (tarif/umumiy yoki qo'lda) belgi bilan
 * ko'rsatiladi; qo'lda qo'yilganini bitta bosish bilan qaytarish mumkin.
 * Tanlov darhol saqlanadi.
 */
export function OrganizationFeaturesCard({
  organizationId,
  panel,
  panelLabel,
  bare,
}: {
  organizationId: string;
  /** Bo'sh — butun bog'cha; aks holda panel kaliti ("TEACHER" ...). */
  panel?: string | null;
  panelLabel?: string;
  bare?: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const queryKey = ["organization-features", organizationId, panel ?? ""];
  const panelQuery = panel ? `?panel=${encodeURIComponent(panel)}` : "";
  const catalog = useFeatureCatalog();
  const state = useQuery({
    queryKey,
    queryFn: () => api.get<OrganizationFeatures>(`/platform/organizations/${organizationId}/features${panelQuery}`),
  });

  const mutation = useMutation({
    mutationFn: (overrides: Record<string, boolean | null>) =>
      api.patch<OrganizationFeatures>(`/platform/organizations/${organizationId}/features${panelQuery}`, { overrides }),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  if (catalog.isLoading || state.isLoading) return <LoadingState />;
  if (catalog.isError || state.isError || !catalog.data || !state.data) {
    return <ErrorState message="Funksiyalarni yuklab bo'lmadi" />;
  }
  const { overrides, planFeatures, base, effective, planName } = state.data;
  // Qo'lda qo'yilmagan funksiya qaysi qiymatni oladi: panelda — butun bog'chadagi, bog'chada — tarifdagi
  const fallbackValues = panel ? base : planFeatures;
  const fallbackName = panel ? "Butun bog'chadan" : "Tarifdan";
  const fallbackTo = panel ? "butun bog'chaga" : "tarifga";

  const set = (patch: Record<string, boolean | null>) => mutation.mutate(patch);
  const resetAll = () => set(Object.fromEntries(Object.keys(overrides).map((k) => [k, null])));
  // Yoqish/o'chirish: yangi qiymat odatiy qiymat bilan bir xil bo'lsa, qo'lda sozlama olib tashlanadi
  const toggle = (key: string) => {
    const own = key in overrides ? overrides[key] : (fallbackValues[key] ?? true);
    const next = !own;
    set({ [key]: next === (fallbackValues[key] ?? true) ? null : next });
  };

  const total = Object.keys(effective).length;
  const onCount = Object.values(effective).filter(Boolean).length;
  const manualCount = Object.keys(overrides).length;

  return (
    <section className={bare ? "p-5" : clsx(card, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {!bare && <h2 className="text-[17px] font-medium text-[var(--color-text)]">Funksiyalar</h2>}
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            {panel ? `${panelLabel ?? panel} paneli` : planName ? `Tarif: ${planName}` : "Obuna yo'q — hammasi yoqilgan"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="rounded-full bg-[var(--color-success-bg)] px-2.5 py-1 font-medium text-[var(--color-success)]">{onCount} ta yoqilgan</span>
            <span className="rounded-full bg-[var(--color-danger-bg)] px-2.5 py-1 font-medium text-[var(--color-danger)]">{total - onCount} ta o&apos;chirilgan</span>
            {manualCount > 0 && (
              <span className="rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1 font-medium text-[var(--color-text)]">{manualCount} ta qo&apos;lda o&apos;zgartirilgan</span>
            )}
          </div>
        </div>
        {manualCount > 0 && (
          <button
            type="button"
            disabled={mutation.isPending}
            className="h-8 cursor-pointer rounded-full bg-[var(--color-surface-sunken)] px-3.5 text-[12.5px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)] disabled:opacity-50"
            onClick={resetAll}
          >
            Hammasini {fallbackTo} qaytarish
          </button>
        )}
      </div>

      {mutation.isError && (
        <div role="alert" className="mt-3 rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
          {mutation.error instanceof ApiError ? mutation.error.message : "Saqlab bo'lmadi"}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
        {groupFeatures(catalog.data).map(([group, features]) => {
          const groupOn = features.filter((f) => effective[f.key]).length;
          const nestedOf = (key: string) => features.filter((f) => NESTED_UNDER[f.key] === key);
          const topLevel = features.filter((f) => !(NESTED_UNDER[f.key] && features.some((x) => x.key === NESTED_UNDER[f.key])));

          const renderRow = (feature: (typeof features)[number], nested: boolean) => {
            const manual = feature.key in overrides;
            const parentOff = !!feature.parent && !effective[feature.parent];
            const on = !!effective[feature.key];
            const inner = nestedOf(feature.key);
            const isOpen = !!open[feature.key];
            const innerOff = inner.filter((f) => !effective[f.key]).length;
            const innerManual = inner.filter((f) => f.key in overrides).length;
            return (
              <div key={feature.key}>
                <div
                  className={clsx(
                    "flex items-center justify-between gap-4 py-3",
                    nested ? "pl-1" : "border-t border-[var(--color-separator)] first:border-t-0",
                    !nested && feature.parent && "ml-4 border-l-2 border-l-[var(--color-border)] pl-3",
                  )}
                >
                  <div className="min-w-0">
                    <div className={clsx("flex flex-wrap items-center gap-2 font-medium text-[var(--color-text)]", nested ? "text-[13.5px]" : "text-[14px]")}>
                      {nested ? shortLabel(feature.label) : feature.label}
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-[11px] font-normal",
                          manual ? "bg-[var(--color-ink)] text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
                        )}
                      >
                        {manual ? "Qo'lda" : fallbackName}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                      {feature.description}
                      {parentOff && " · asosiy bo'lim o'chiq, shuning uchun bu ham ishlamaydi"}
                    </div>
                    {manual && (
                      <button
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() => set({ [feature.key]: null })}
                        className="mt-1 cursor-pointer text-[12px] text-[var(--color-primary)] disabled:opacity-50"
                      >
                        Qo&apos;lda qo&apos;yilganini {fallbackTo} qaytarish ({fallbackValues[feature.key] ?? true ? "yoqilgan" : "o'chirilgan"})
                      </button>
                    )}
                    {inner.length > 0 && (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen((o) => ({ ...o, [feature.key]: !o[feature.key] }))}
                        className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--color-surface-sunken)] px-3 py-1 text-[12px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
                      >
                        <span aria-hidden className={clsx("inline-block transition-transform", isOpen && "rotate-90")}>
                          ›
                        </span>
                        {isOpen ? "Ichidagilarni yopish" : `Ichidagi sozlamalar (${inner.length})`}
                        {!isOpen && innerOff > 0 && <span className="text-[var(--color-danger)]">· {innerOff} ta o&apos;chirilgan</span>}
                        {!isOpen && innerOff === 0 && innerManual > 0 && <span className="text-[var(--color-text-muted)]">· {innerManual} ta qo&apos;lda</span>}
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <Switch checked={on} label={feature.label} disabled={mutation.isPending || parentOff} onChange={() => toggle(feature.key)} />
                    <span className={clsx("text-[11px] font-medium", on ? "text-[var(--color-success)]" : "text-[var(--color-text-subtle)]")}>
                      {on ? "Yoqilgan" : "O'chirilgan"}
                    </span>
                  </div>
                </div>
                {inner.length > 0 && isOpen && (
                  <div className="mb-3 ml-2 rounded-[var(--radius-lg)] border-l-2 border-l-[var(--color-ink)] bg-[var(--color-surface-sunken)]/60 px-3 pb-1 pt-2">
                    {NESTED_HINT[feature.key] && <p className="pb-1 text-[11.5px] text-[var(--color-text-muted)]">{NESTED_HINT[feature.key]}</p>}
                    {inner.map((child) => renderRow(child, true))}
                  </div>
                )}
              </div>
            );
          };

          return (
            <div key={group}>
              <div className="mb-1 flex items-center justify-between border-b border-[var(--color-border)] pb-2 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                <span>{group}</span>
                <span className="normal-case tracking-normal">
                  {groupOn} / {features.length}
                </span>
              </div>
              {topLevel.map((feature) => renderRow(feature, false))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
