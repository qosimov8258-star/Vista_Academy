"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api, getPaginated } from "@/lib/api";
import type { FeaturePanel, Organization } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { ShieldIcon } from "@/components/ui/icons";
import { OrganizationFeaturesCard } from "./organization-features-card";

const STORAGE_KEY = "zeeron.dashboard.features-org";

/**
 * Dashboard'dagi "Funksiyalarni boshqarish": bog'chani tanlaysiz — uning
 * barcha funksiyalarini shu yerning o'zida yoqasiz/o'chirasiz.
 */
export function DashboardFeaturesPanel() {
  const [orgId, setOrgId] = useState("");
  // "" — butun bog'cha, aks holda panel kaliti
  const [panel, setPanel] = useState("");
  const panelsQuery = useQuery({
    queryKey: ["feature-panels"],
    queryFn: () => api.get<FeaturePanel[]>("/platform/feature-panels"),
    staleTime: 5 * 60 * 1000,
  });
  const panels = panelsQuery.data ?? [];
  const panelLabel = panels.find((p) => p.key === panel)?.label;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["organizations", "features-picker"],
    queryFn: () => getPaginated<Organization>("/platform/organizations?limit=100&sort=name"),
  });
  const organizations = (data?.data ?? []).filter((o) => o.status !== "ARCHIVED");

  // Oxirgi tanlangan bog'cha eslab qolinadi (qulaylik, majburiy emas)
  useEffect(() => {
    if (orgId || organizations.length === 0) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Maxfiy rejim — birinchi bog'cha tanlanadi
    }
    setOrgId(organizations.find((o) => o.id === saved)?.id ?? organizations[0].id);
  }, [organizations, orgId]);

  const choose = (id: string) => {
    setOrgId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // e'tiborsiz
    }
  };

  const panelHelp = panel
    ? `Faqat «${panelLabel}» paneli. Bu yerdagi o'zgarish boshqa panellarga tegmaydi. «Butun bog'chadan» belgisi — umumiy sozlama amal qilayotganini bildiradi.`
    : "Bog'chaning hamma panellariga (Super Admin, Filial admini, O'qituvchilar...) birdan ta'sir qiladi. Bitta panelni alohida sozlash uchun yuqoridan uni tanlang.";

  return (
    <section
      aria-label="Funksiyalarni boshqarish"
      className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
    >
      {/* 1-qadam: qaysi bog'cha */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[19px] font-medium text-[var(--color-text)]">Funksiyalarni boshqarish</h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">Yoqish yoki o&apos;chirish bir bosishda darhol saqlanadi</p>
          </div>
        </div>
        <label className="flex items-center gap-3">
          <span className="text-[12.5px] font-medium text-[var(--color-text-muted)]">1. Bog&apos;cha</span>
          <select
            aria-label="Bog'cha"
            value={orgId}
            onChange={(event) => choose(event.target.value)}
            disabled={organizations.length === 0}
            className="h-10 min-w-[220px] cursor-pointer rounded-full bg-[var(--color-surface-sunken)] px-4 text-[13.5px] font-medium text-[var(--color-text)] outline-none"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} · {org.slug}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 2-qadam: qaysi panel */}
      <div className="px-5 pt-5">
        <div className="mb-2 text-[12.5px] font-medium text-[var(--color-text-muted)]">2. Qaysi panel uchun?</div>
        <div role="tablist" aria-label="Panel" className="flex flex-wrap gap-2">
          {[{ key: "", label: "Butun bog'cha" }, ...panels].map((item) => (
            <button
              key={item.key || "all"}
              type="button"
              role="tab"
              aria-selected={panel === item.key}
              onClick={() => setPanel(item.key)}
              className={clsx(
                "h-9 cursor-pointer rounded-full px-4 text-[13.5px] font-medium transition-colors",
                panel === item.key
                  ? "bg-[var(--color-ink)] text-white"
                  : "bg-[var(--color-surface-sunken)] text-[var(--color-text)] hover:bg-[var(--color-border)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5 text-[12.5px] text-[var(--color-text-muted)]">{panelHelp}</p>
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={(error as Error).message} />}
      {orgId && <OrganizationFeaturesCard key={`${orgId}:${panel}`} organizationId={orgId} panel={panel} panelLabel={panelLabel} bare />}
    </section>
  );
}
