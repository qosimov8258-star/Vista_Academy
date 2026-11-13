"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getPaginated } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import type { FeatureDefinition, FeaturePanel, Organization, OrganizationFeatures } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { CheckIcon, ChevronDownIcon, CloseIcon, RefreshIcon, SearchIcon } from "@/components/ui/icons";
import { groupFeatures, useFeatureCatalog } from "./use-feature-catalog";

const STORAGE_KEY = "zeeron.dashboard.features-org";

/** "" — butun bog'cha ustuni; qolganlari panel kalitlari ("TEACHER" ...). */
type Column = { key: string; label: string };
const ORG_COLUMN: Column = { key: "", label: "Butun bog'cha" };

type Filter = "all" | "manual" | "off";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "manual", label: "Qo'lda o'zgartirilgan" },
  { key: "off", label: "O'chirilganlar" },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/**
 * Funksiyalar matritsasi (ERP'lardagi ruxsatlar jadvali kabi): chapda
 * bog'chalar, o'ngda jadval — qatorlar funksiyalar, ustunlar «Butun bog'cha»
 * va har bir panel. Har katak bir bosishda yoqiladi/o'chiriladi va darhol
 * saqlanadi. Qo'lda qo'yilgan qiymat to'q rangda, meros (tarifdan yoki butun
 * bog'chadan) och rangda; qo'lda qo'yilganini katak burchagidagi ↺ qaytaradi.
 */
export function FeatureMatrix() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === "PLATFORM_SUPER_ADMIN";

  const [orgId, setOrgId] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const catalog = useFeatureCatalog();
  const panelsQuery = useQuery({
    queryKey: ["feature-panels"],
    queryFn: () => api.get<FeaturePanel[]>("/platform/feature-panels"),
    staleTime: 5 * 60 * 1000,
  });
  const orgsQuery = useQuery({
    queryKey: ["organizations", "features-picker"],
    queryFn: () => getPaginated<Organization>("/platform/organizations?limit=100&sort=name"),
  });
  const organizations = useMemo(() => (orgsQuery.data?.data ?? []).filter((o) => o.status !== "ARCHIVED"), [orgsQuery.data]);
  const columns: Column[] = useMemo(() => [ORG_COLUMN, ...(panelsQuery.data ?? [])], [panelsQuery.data]);

  // Oxirgi tanlangan bog'cha eslab qolinadi
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
    setConfirmReset(false);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // e'tiborsiz
    }
  };

  const keyFor = (panel: string) => ["organization-features", orgId, panel];
  const urlFor = (panel: string) => `/platform/organizations/${orgId}/features${panel ? `?panel=${encodeURIComponent(panel)}` : ""}`;

  const states = useQueries({
    queries: columns.map((col) => ({
      queryKey: keyFor(col.key),
      queryFn: () => api.get<OrganizationFeatures>(urlFor(col.key)),
      enabled: !!orgId && panelsQuery.isSuccess,
    })),
  });
  const byColumn = new Map(columns.map((col, i) => [col.key, states[i]?.data]));

  // Qaysi katak saqlanmoqda — faqat o'sha katak xira bo'ladi
  const [pending, setPending] = useState<Set<string>>(new Set());
  const mutation = useMutation({
    mutationFn: ({ panel, overrides }: { panel: string; overrides: Record<string, boolean | null> }) =>
      api.patch<OrganizationFeatures>(urlFor(panel), { overrides }),
    onMutate: ({ panel, overrides }) => {
      setPending((s) => new Set([...s, ...Object.keys(overrides).map((k) => `${panel}:${k}`)]));
    },
    onSuccess: (data, { panel }) => {
      queryClient.setQueryData(keyFor(panel), data);
      // Butun bog'cha o'zgarsa — panellarning meros qiymati ham o'zgaradi
      if (panel === "") queryClient.invalidateQueries({ queryKey: ["organization-features", orgId] });
    },
    onSettled: (_d, _e, { panel, overrides }) => {
      setPending((s) => {
        const next = new Set(s);
        Object.keys(overrides).forEach((k) => next.delete(`${panel}:${k}`));
        return next;
      });
    },
  });

  const loading = catalog.isLoading || panelsQuery.isLoading || orgsQuery.isLoading;
  const failed = catalog.isError || panelsQuery.isError || orgsQuery.isError;
  const org = organizations.find((o) => o.id === orgId);
  const orgState = byColumn.get("");
  const allLoaded = columns.every((c) => byColumn.get(c.key));

  /** Qo'lda qo'yilmagan qiymat qayerdan keladi: panelda — butun bog'chadan, bog'chada — tarifdan */
  const fallbackOf = (panel: string, key: string) => {
    const s = byColumn.get(panel);
    if (!s) return true;
    return (panel ? s.base[key] : s.planFeatures[key]) ?? true;
  };

  const toggle = (panel: string, key: string) => {
    const s = byColumn.get(panel);
    if (!s) return;
    const fallback = fallbackOf(panel, key);
    const own = key in s.overrides ? s.overrides[key] : fallback;
    const next = !own;
    mutation.mutate({ panel, overrides: { [key]: next === fallback ? null : next } });
  };
  const reset = (panel: string, key: string) => mutation.mutate({ panel, overrides: { [key]: null } });

  const manualTotal = columns.reduce((n, c) => n + Object.keys(byColumn.get(c.key)?.overrides ?? {}).length, 0);
  const resetAll = () => {
    setConfirmReset(false);
    for (const c of columns) {
      const o = byColumn.get(c.key)?.overrides ?? {};
      if (Object.keys(o).length) mutation.mutate({ panel: c.key, overrides: Object.fromEntries(Object.keys(o).map((k) => [k, null])) });
    }
  };

  const filteredOrgs = organizations.filter((o) => {
    const q = orgSearch.trim().toLowerCase();
    return !q || o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q);
  });

  const q = search.trim().toLowerCase();
  const rowVisible = (f: FeatureDefinition) => {
    if (q && !`${f.label} ${f.description}`.toLowerCase().includes(q)) return false;
    if (filter === "manual") return columns.some((c) => f.key in (byColumn.get(c.key)?.overrides ?? {}));
    if (filter === "off") return columns.some((c) => byColumn.get(c.key)?.effective[f.key] === false);
    return true;
  };

  if (loading) return <LoadingState />;
  if (failed) return <ErrorState message="Funksiyalarni yuklab bo'lmadi" />;

  const groups = groupFeatures(catalog.data ?? []);
  const featureCount = catalog.data?.length ?? 0;
  const visibleGroups = groups.map(([g, fs]) => [g, fs.filter(rowVisible)] as const).filter(([, fs]) => fs.length > 0);

  return (
    <div>
      {/* Jadval */}
      <section className="min-w-0 rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <OrgPicker
              organizations={organizations}
              selected={org}
              open={pickerOpen}
              onOpenChange={(v) => {
                setPickerOpen(v);
                if (!v) setOrgSearch("");
              }}
              search={orgSearch}
              onSearch={setOrgSearch}
              filtered={filteredOrgs}
              onChoose={(id) => {
                choose(id);
                setPickerOpen(false);
                setOrgSearch("");
              }}
            />
            <p className="hidden text-[12.5px] text-[var(--color-text-muted)] md:block">
              {orgState?.planName ? `Tarif: ${orgState.planName}` : "Obuna yo'q"} · {featureCount} ta funksiya · {columns.length - 1} ta panel
            </p>
          </div>
          <div className="flex items-center gap-2">
            {manualTotal > 0 && (
              <span className="rounded-full bg-[var(--color-surface-sunken)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-text)]">
                {manualTotal} ta qo&apos;lda o&apos;zgartirilgan
              </span>
            )}
            {canEdit && manualTotal > 0 && (
              confirmReset ? (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={resetAll}
                    className="h-8 cursor-pointer rounded-full bg-[var(--color-danger)] px-3.5 text-[12.5px] font-medium text-white"
                  >
                    Ha, hammasini qaytarish
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="h-8 cursor-pointer rounded-full bg-[var(--color-surface-sunken)] px-3.5 text-[12.5px] font-medium text-[var(--color-text)]"
                  >
                    Bekor
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--color-surface-sunken)] px-3.5 text-[12.5px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
                >
                  <RefreshIcon className="h-3.5 w-3.5" />
                  Tarifga qaytarish
                </button>
              )
            )}
          </div>
        </div>

        {/* Asboblar qatori */}
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-4">
          <label className="flex h-9 w-full max-w-[280px] items-center gap-2 rounded-full bg-[var(--color-surface-sunken)] px-3">
            <SearchIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Funksiyani qidirish"
              aria-label="Funksiyani qidirish"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-subtle)]"
            />
          </label>
          <div role="tablist" aria-label="Saralash" className="flex max-w-full overflow-x-auto rounded-full bg-[var(--color-surface-sunken)] p-[3px]">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  "h-[30px] shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-medium transition-colors",
                  filter === f.key ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Legend />
        </div>

        {!canEdit && user && (
          <p className="mx-5 mb-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5 text-[12.5px] text-[var(--color-text-muted)]">
            Siz faqat ko&apos;ra olasiz — o&apos;zgartirish Platform Super Admin uchun.
          </p>
        )}
        {mutation.isError && (
          <p role="alert" className="mx-5 mb-3 rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[13px] text-[var(--color-danger)]">
            {mutation.error instanceof ApiError ? mutation.error.message : "Saqlab bo'lmadi"}
          </p>
        )}

        {!allLoaded ? (
          <LoadingState />
        ) : (
          <div className="max-h-[calc(100vh-280px)] min-h-[360px] overflow-auto border-t border-[var(--color-separator)]">
            <table className="w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-[170px] sm:min-w-[280px] border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                    Funksiya
                  </th>
                  {columns.map((c) => {
                    const s = byColumn.get(c.key);
                    const on = s ? Object.values(s.effective).filter(Boolean).length : 0;
                    return (
                      <th
                        key={c.key || "org"}
                        className={clsx(
                          "sticky top-0 z-20 min-w-[76px] border-b sm:min-w-[92px] border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3 text-center align-bottom",
                          c.key === "" && "border-r border-r-[var(--color-separator)] bg-[var(--color-surface-sunken)]",
                        )}
                      >
                        <span className="block text-[12.5px] font-medium leading-tight text-[var(--color-text)]">{c.label}</span>
                        <span className="mt-0.5 block text-[11px] tabular-nums text-[var(--color-text-subtle)]">
                          {on}/{featureCount}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map(([group, features]) => {
                  const isCollapsed = !!collapsed[group] && !q;
                  const orgOn = features.filter((f) => orgState?.effective[f.key]).length;
                  return (
                    <Fragment key={group}>
                      <tr>
                        <td colSpan={columns.length + 1} className="sticky left-0 border-b border-[var(--color-separator)] bg-[var(--color-surface)] p-0">
                          <button
                            type="button"
                            onClick={() => setCollapsed((c) => ({ ...c, [group]: !c[group] }))}
                            aria-expanded={!isCollapsed}
                            className="flex w-full cursor-pointer items-center gap-2 px-5 pb-2 pt-5 text-left"
                          >
                            <ChevronDownIcon className={clsx("h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform", isCollapsed && "-rotate-90")} />
                            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-text)]">{group}</span>
                            <span className="text-[11.5px] tabular-nums text-[var(--color-text-subtle)]">
                              {orgOn}/{features.length}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {!isCollapsed &&
                        features.map((f) => {
                          const child = !!f.parent && features.some((x) => x.key === f.parent);
                          return (
                            <tr key={f.key} className="group/row hover:bg-[var(--color-surface-hover)]">
                              <td className="sticky left-0 z-10 border-b border-[var(--color-separator)] bg-[var(--color-surface)] py-2.5 pr-4 group-hover/row:bg-[var(--color-surface-hover)]">
                                <div className={clsx("min-w-0", child ? "ml-9 border-l-2 border-[var(--color-border)] pl-3" : "pl-5")}>
                                  <div className={clsx("font-medium text-[var(--color-text)]", child ? "text-[13px]" : "text-[13.5px]")}>{f.label}</div>
                                  <div className="hidden max-w-[300px] truncate text-[11.5px] sm:block text-[var(--color-text-muted)]" title={f.description}>
                                    {f.description}
                                  </div>
                                </div>
                              </td>
                              {columns.map((c) => (
                                <td
                                  key={c.key || "org"}
                                  className={clsx(
                                    "border-b border-[var(--color-separator)] px-2 py-2 text-center",
                                    c.key === "" && "border-r border-r-[var(--color-separator)] bg-[var(--color-surface-sunken)]/50",
                                  )}
                                >
                                  <Cell
                                    state={byColumn.get(c.key)!}
                                    column={c}
                                    feature={f}
                                    fallback={fallbackOf(c.key, f.key)}
                                    canEdit={canEdit}
                                    pending={pending.has(`${c.key}:${f.key}`)}
                                    onToggle={() => toggle(c.key, f.key)}
                                    onReset={() => reset(c.key, f.key)}
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
                {visibleGroups.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-5 py-12 text-center text-[13px] text-[var(--color-text-muted)]">
                      {filter === "manual" ? "Qo'lda o'zgartirilgan funksiya yo'q — hammasi tarif bo'yicha" : filter === "off" ? "O'chirilgan funksiya yo'q" : "Hech narsa topilmadi"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Cell({
  state,
  column,
  feature,
  fallback,
  canEdit,
  pending,
  onToggle,
  onReset,
}: {
  state: OrganizationFeatures;
  column: Column;
  feature: FeatureDefinition;
  fallback: boolean;
  canEdit: boolean;
  pending: boolean;
  onToggle: () => void;
  onReset: () => void;
}) {
  const on = !!state.effective[feature.key];
  const manual = feature.key in state.overrides;
  const parentOff = !!feature.parent && !state.effective[feature.parent];
  const source = column.key ? "butun bog'chadan" : "tarifdan";
  const title = [
    `${column.label}: ${on ? "yoqilgan" : "o'chirilgan"}`,
    parentOff ? "asosiy bo'lim o'chiq" : manual ? `qo'lda (${source}: ${fallback ? "yoqilgan" : "o'chirilgan"})` : source,
  ].join(" · ");

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${feature.label} — ${column.label}`}
        title={title}
        disabled={!canEdit || parentOff || pending}
        onClick={onToggle}
        className={clsx(
          "flex h-7 w-7 items-center justify-center rounded-[8px] transition-[transform,background-color] enabled:cursor-pointer enabled:active:scale-90 disabled:cursor-not-allowed",
          pending && "animate-pulse",
          parentOff && "opacity-35",
          on
            ? manual
              ? "bg-[var(--color-success)] text-white"
              : "bg-[var(--color-success-bg)] text-[var(--color-success)]"
            : manual
              ? "bg-[var(--color-danger)] text-white"
              : "bg-[var(--color-surface-sunken)] text-[var(--color-text-subtle)] ring-1 ring-inset ring-[var(--color-border)]",
        )}
      >
        {on ? <CheckIcon className="h-4 w-4" /> : manual ? <CloseIcon className="h-3.5 w-3.5" /> : <span className="h-[2px] w-2.5 rounded-full bg-current" />}
      </button>
      {manual && canEdit && !pending && (
        <button
          type="button"
          onClick={onReset}
          title={`Qo'lda qo'yilganini qaytarish (${source})`}
          aria-label={`${feature.label} — ${column.label}: qaytarish`}
          className="absolute -right-2 -top-2 hidden h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-[var(--color-ink)] text-white shadow group-hover/row:flex"
        >
          <RefreshIcon className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

function Legend() {
  const item = (cls: string, content: React.ReactNode, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx("flex h-4 w-4 items-center justify-center rounded-[5px]", cls)}>{content}</span>
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 lg:ml-auto gap-y-1 text-[11.5px] text-[var(--color-text-muted)]">
      {item("bg-[var(--color-success-bg)] text-[var(--color-success)]", <CheckIcon className="h-3 w-3" />, "Yoqilgan")}
      {item("bg-[var(--color-surface-sunken)] ring-1 ring-inset ring-[var(--color-border)]", null, "O'chirilgan")}
      {item("bg-[var(--color-success)] text-white", <CheckIcon className="h-3 w-3" />, "Qo'lda yoqilgan")}
      {item("bg-[var(--color-danger)] text-white", <CloseIcon className="h-2.5 w-2.5" />, "Qo'lda o'chirilgan")}
    </div>
  );
}

/** Bog'cha tanlagich — qidiruvli ochiluvchi ro'yxat (SaaS'lardagi «workspace» almashtirgich kabi). */
function OrgPicker({
  organizations,
  selected,
  open,
  onOpenChange,
  search,
  onSearch,
  filtered,
  onChoose,
}: {
  organizations: Organization[];
  selected: Organization | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearch: (value: string) => void;
  filtered: Organization[];
  onChoose: (id: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex max-w-full cursor-pointer items-center gap-3 rounded-full bg-[var(--color-surface-sunken)] py-1.5 pl-1.5 pr-4 text-left transition-colors hover:bg-[var(--color-border)]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[12.5px] font-semibold text-white">
          {selected ? initials(selected.name) : "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium leading-tight text-[var(--color-text)]">{selected?.name ?? "Bog'cha tanlang"}</span>
          <span className="block truncate text-[11.5px] text-[var(--color-text-muted)]">{selected?.slug ?? `${organizations.length} ta bog'cha`}</span>
        </span>
        <ChevronDownIcon className={clsx("h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Yopish" className="fixed inset-0 z-40 cursor-default" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[320px] max-w-[calc(100vw-32px)] rounded-[20px] bg-[var(--color-surface)] p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35),0_0_0_1px_rgba(0,0,0,0.05)]">
            <label className="flex h-9 items-center gap-2 rounded-full bg-[var(--color-surface-sunken)] px-3">
              <SearchIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && filtered[0] && onChoose(filtered[0].id)}
                placeholder="Bog'cha nomi yoki manzili"
                aria-label="Bog'cha qidirish"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-subtle)]"
              />
            </label>
            <ul role="listbox" className="mt-1.5 max-h-[320px] space-y-0.5 overflow-y-auto">
              {filtered.map((o) => {
                const active = o.id === selected?.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => onChoose(o.id)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[12px] font-semibold text-[var(--color-text)]">
                        {initials(o.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-[var(--color-text)]">{o.name}</span>
                        <span className="block truncate text-[11.5px] text-[var(--color-text-muted)]">
                          {o.subscription?.plan?.name ?? "Obunasiz"} · {o.slug}
                        </span>
                      </span>
                      {o.status === "SUSPENDED" && (
                        <span className="shrink-0 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--color-warning)]">To&apos;xtatilgan</span>
                      )}
                      {active && <CheckIcon className="h-4 w-4 shrink-0 text-[var(--color-text)]" />}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-[12.5px] text-[var(--color-text-muted)]">Topilmadi</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
