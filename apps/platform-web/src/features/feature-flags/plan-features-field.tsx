"use client";

import { LoadingState, ErrorState } from "@/components/ui/states";
import { groupFeatures, useFeatureCatalog } from "./use-feature-catalog";
import { Switch } from "./switch";

/** Tarif uchun funksiyalar: kalit yo'q bo'lsa — yoqilgan hisoblanadi. */
export function PlanFeaturesField({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}) {
  const catalog = useFeatureCatalog();
  if (catalog.isLoading) return <LoadingState />;
  if (catalog.isError || !catalog.data) return <ErrorState message="Funksiyalar ro'yxatini yuklab bo'lmadi" />;

  const isOn = (key: string) => value[key] ?? true;
  const setAll = (on: boolean) => onChange(Object.fromEntries(catalog.data.map((f) => [f.key, on])));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--color-text)]">Tarifdagi funksiyalar</span>
        <span className="flex gap-3 text-[12.5px]">
          <button type="button" className="cursor-pointer text-[var(--color-primary)]" onClick={() => setAll(true)}>
            Hammasini yoqish
          </button>
          <button type="button" className="cursor-pointer text-[var(--color-text-muted)]" onClick={() => setAll(false)}>
            Hammasini o&apos;chirish
          </button>
        </span>
      </div>
      <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] p-3">
        {groupFeatures(catalog.data).map(([group, features]) => (
          <div key={group}>
            <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">{group}</div>
            {features.map((feature) => (
              <div key={feature.key} className={`flex items-center justify-between gap-3 py-1.5 ${feature.parent ? "ml-4 border-l-2 border-[var(--color-border)] pl-3" : ""}`}>
                <div className="min-w-0">
                  <div className="text-[13.5px] text-[var(--color-text)]">{feature.label}</div>
                  <div className="truncate text-[12px] text-[var(--color-text-muted)]">{feature.description}</div>
                </div>
                <Switch
                  checked={isOn(feature.key)}
                  label={feature.label}
                  onChange={(on) => onChange({ ...value, [feature.key]: on })}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
