"use client";

import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { OrganizationFeatures } from "@/lib/types";
import { Segmented } from "@/components/ui/segmented";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { groupFeatures, useFeatureCatalog } from "./use-feature-catalog";

type Choice = "plan" | "on" | "off";

const card = "rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

const CHOICES = [
  { value: "plan" as const, label: "Tarif" },
  { value: "on" as const, label: "Yoqish" },
  { value: "off" as const, label: "O'chirish" },
];

/**
 * Bog'cha sahifasidagi "Funksiyalar": har biri uchun "Tarifga ko'ra" /
 * majburan yoqish / majburan o'chirish. Tanlov darhol saqlanadi.
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
  // Panelda "Tarif" o'rniga "Umumiy": panel sozlamasi yo'q bo'lsa bog'cha/tarif qiymati amal qiladi
  const fallbackValues = panel ? base : planFeatures;
  const choices = panel ? CHOICES.map((c) => (c.value === "plan" ? { ...c, label: "Umumiy" } : c)) : CHOICES;

  const choiceOf = (key: string): Choice => (key in overrides ? (overrides[key] ? "on" : "off") : "plan");
  const set = (patch: Record<string, boolean | null>) => mutation.mutate(patch);
  const resetAll = () => set(Object.fromEntries(Object.keys(overrides).map((k) => [k, null])));
  const offCount = Object.values(effective).filter((on) => !on).length;

  return (
    <section className={bare ? "p-5" : clsx(card, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {!bare && <h2 className="text-[17px] font-medium text-[var(--color-text)]">Funksiyalar</h2>}
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            {panel ? `${panelLabel ?? panel} paneli. ` : planName ? `Tarif: ${planName}. ` : "Obuna yo'q — hammasi yoqilgan. "}
            {offCount > 0 ? `${offCount} ta funksiya o'chirilgan.` : "Hamma funksiya yoqilgan."}
          </p>
        </div>
        {Object.keys(overrides).length > 0 && (
          <button type="button" className="cursor-pointer text-[12.5px] text-[var(--color-primary)]" onClick={resetAll}>
            Hammasini qaytarish
          </button>
        )}
      </div>

      {mutation.isError && (
        <div role="alert" className="mt-3 rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
          {mutation.error instanceof ApiError ? mutation.error.message : "Saqlab bo'lmadi"}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
        {groupFeatures(catalog.data).map(([group, features]) => (
          <div key={group}>
            <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">{group}</div>
            {features.map((feature) => (
              <div
                key={feature.key}
                className={clsx(
                  "flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-separator)] py-2 first:border-t-0",
                  feature.parent && "ml-4 border-l-2 border-l-[var(--color-border)] pl-3",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13.5px] text-[var(--color-text)]">
                    {feature.label}
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[11px]",
                        effective[feature.key]
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                          : "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
                      )}
                    >
                      {effective[feature.key] ? "yoqilgan" : "o'chirilgan"}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--color-text-muted)]">
                    {feature.description}
                    {feature.parent && !effective[feature.parent] ? " · asosiy bo'lim o'chiq" : ""}
                    {choiceOf(feature.key) === "plan" ? ` · ${panel ? "umumiy" : "tarifda"}: ${fallbackValues[feature.key] ? "yoqilgan" : "o'chirilgan"}` : ""}
                  </div>
                </div>
                <Segmented
                  ariaLabel={feature.label}
                  options={choices}
                  value={choiceOf(feature.key)}
                  onChange={(choice) => set({ [feature.key]: choice === "plan" ? null : choice === "on" })}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
