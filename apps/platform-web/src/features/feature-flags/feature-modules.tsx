"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getPaginated } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import type { FeatureDefinition, FeaturePanel, Organization, OrganizationFeatures } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { RefreshIcon, SearchIcon, ShieldIcon } from "@/components/ui/icons";
import { groupFeatures, useFeatureCatalog } from "./use-feature-catalog";
import { OrgPicker } from "./org-picker";

const STORAGE_KEY = "zeeron.dashboard.features-org";

/** Saqlanmagan o'zgarishlar: doira ("" — butun bog'cha, aks holda panel) → funksiya → qiymat (null — tarifga/umumiyga qaytarish). */
type Drafts = Record<string, Record<string, boolean | null>>;

/**
 * Funksiyalar («Modullar»): yuqorida bog'cha va sozlash doirasi (butun
 * bog'cha yoki bitta panel), chapda bo'limlar, o'ngda shu bo'lim
 * funksiyalari kartalarda. O'zgarishlar avval yig'iladi va pastdagi
 * «Saqlash» bilan birga yoziladi; «Bekor» ularni tashlab yuboradi.
 */
export function FeatureModules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === "PLATFORM_SUPER_ADMIN";

  const [orgId, setOrgId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const [scope, setScope] = useState("");
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
  const scopes = useMemo(() => [{ key: "", label: "Butun bog'cha" }, ...(panelsQuery.data ?? [])], [panelsQuery.data]);

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

  const urlFor = (panel: string) => `/platform/organizations/${orgId}/features${panel ? `?panel=${encodeURIComponent(panel)}` : ""}`;
  const state = useQuery({
    queryKey: ["organization-features", orgId, scope],
    queryFn: () => api.get<OrganizationFeatures>(urlFor(scope)),
    enabled: !!orgId,
  });

  const groups = useMemo(() => groupFeatures(catalog.data ?? []), [catalog.data]);
  useEffect(() => {
    if (!group && groups.length) setGroup(groups[0][0]);
  }, [groups, group]);

  const dirtyCount = Object.values(drafts).reduce((n, d) => n + Object.keys(d).length, 0);
  const draft = drafts[scope] ?? {};
  const s = state.data;
  const fromPlan = scope === "";
  const fallbackOf = (key: string) => (s ? ((fromPlan ? s.planFeatures[key] : s.base[key]) ?? true) : true);
  /** Qo'lda qo'yilgan qiymat (saqlanmagani bilan); undefined — qo'lda emas */
  const manualOf = (key: string): boolean | undefined => {
    if (key in draft) return draft[key] ?? undefined;
    return s && key in s.overrides ? s.overrides[key] : undefined;
  };
  const valueOf = (key: string) => manualOf(key) ?? fallbackOf(key);
  const enabledOf = (f: FeatureDefinition) => valueOf(f.key) && (!f.parent || valueOf(f.parent));
  const differs = (key: string) => {
    const m = manualOf(key);
    return m !== undefined && m !== fallbackOf(key);
  };

  /** Yangi qiymat odatiy qiymatga teng bo'lsa — qo'lda sozlama olib tashlanadi */
  const setValues = (values: Record<string, boolean | null>) => {
    if (!s) return;
    setSaveError(null);
    setDrafts((all) => {
      const next = { ...(all[scope] ?? {}) };
      for (const [key, value] of Object.entries(values)) {
        const wanted = value === null || value === fallbackOf(key) ? null : value;
        const saved = key in s.overrides ? s.overrides[key] : null;
        if (wanted === saved) delete next[key];
        else next[key] = wanted;
      }
      const out = { ...all };
      if (Object.keys(next).length) out[scope] = next;
      else delete out[scope];
      return out;
    });
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Avval butun bog'cha — panellarning meros qiymati shunga bog'liq
      const order = Object.keys(drafts).sort((a, b) => (a === "" ? -1 : b === "" ? 1 : 0));
      for (const panel of order) {
        await api.patch<OrganizationFeatures>(urlFor(panel), { overrides: drafts[panel] });
        setDrafts((all) => {
          const out = { ...all };
          delete out[panel];
          return out;
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["organization-features", orgId] });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  if (catalog.isLoading || panelsQuery.isLoading || orgsQuery.isLoading) return <LoadingState />;
  if (catalog.isError || panelsQuery.isError || orgsQuery.isError) return <ErrorState message="Funksiyalarni yuklab bo'lmadi" />;

  const org = organizations.find((o) => o.id === orgId);
  const scopeLabel = scopes.find((x) => x.key === scope)?.label ?? "";
  const filteredOrgs = organizations.filter((o) => {
    const q = orgSearch.trim().toLowerCase();
    return !q || o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q);
  });
  const q = search.trim().toLowerCase();
  const matches = (f: FeatureDefinition) => `${f.label} ${f.description} ${f.group}`.toLowerCase().includes(q);
  const current = groups.find(([g]) => g === group)?.[1] ?? [];
  const shown: [string, FeatureDefinition[]][] = q
    ? groups.map(([g, fs]) => [g, fs.filter(matches)] as [string, FeatureDefinition[]]).filter(([, fs]) => fs.length > 0)
    : [[group, current]];
  const differCount = (catalog.data ?? []).filter((f) => differs(f.key)).length;
  const sourceWord = fromPlan ? "tarifdan" : "butun bog'chadan";

  return (
    <section className="flex flex-col rounded-[28px] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      {/* Sarlavha: bog'cha tanlagichi va tarifi */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-6">
        <OrgPicker
          organizations={organizations}
          selected={org}
          open={pickerOpen}
          disabled={dirtyCount > 0}
          onOpenChange={(v) => {
            setPickerOpen(v);
            if (!v) setOrgSearch("");
          }}
          search={orgSearch}
          onSearch={setOrgSearch}
          filtered={filteredOrgs}
          onChoose={(id) => {
            setOrgId(id);
            setPickerOpen(false);
            setOrgSearch("");
            try {
              localStorage.setItem(STORAGE_KEY, id);
            } catch {
              // e'tiborsiz
            }
          }}
        />
        {s && (
          <span className="rounded-full bg-[var(--color-surface-sunken)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--color-text-muted)]">
            {s.planName ? `Tarif: ${s.planName}` : "Obunasiz"} · {catalog.data?.length ?? 0} ta modul
          </span>
        )}
      </div>

      {/* Sozlash doirasi */}
      <div className="px-6 pb-5">
        <div className="rounded-[22px] border border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2.5 text-[15px] font-medium text-[var(--color-text)]">
            <ShieldIcon className="h-[18px] w-[18px] text-[var(--color-text-muted)]" />
            Qaysi panel uchun sozlanadi
          </div>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
            {fromPlan
              ? "Butun bog'cha — hamma panellarga birdan ta'sir qiladi. Bitta panelni alohida sozlash uchun uni tanlang."
              : `Faqat «${scopeLabel}» paneli. Boshqa panellarga tegmaydi; o'zgartirilmagan funksiya butun bog'chadagi qiymatni oladi.`}
          </p>
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {scopes.map((x) => {
              const pending = !!drafts[x.key];
              return (
                <button
                  key={x.key || "org"}
                  type="button"
                  aria-pressed={scope === x.key}
                  onClick={() => setScope(x.key)}
                  className={clsx(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors",
                    scope === x.key ? "bg-[var(--color-ink)] text-white" : "bg-[var(--color-surface-sunken)] text-[var(--color-text)] hover:bg-[var(--color-border)]",
                  )}
                >
                  {x.label}
                  {pending && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" title="Saqlanmagan o'zgarish bor" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tana: bo'limlar | funksiyalar */}
      <div className="grid min-h-0 flex-1 grid-cols-1 border-t border-dashed border-[var(--color-border)] md:grid-cols-[300px_minmax(0,1fr)]">
        <nav aria-label="Bo'limlar" className="border-dashed border-[var(--color-border)] p-4 max-md:border-b md:border-r">
          <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {groups.map(([g, fs]) => {
              const on = fs.filter(enabledOf).length;
              const dot = fs.some((f) => differs(f.key));
              const active = !q && g === group;
              return (
                <li key={g} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setGroup(g);
                      setSearch("");
                    }}
                    aria-current={active}
                    className={clsx(
                      "flex h-12 w-full cursor-pointer items-center gap-3 whitespace-nowrap rounded-full px-5 text-left transition-colors",
                      active ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{g}</span>
                    {dot && <span className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-white" : "bg-[var(--color-text)]")} title={`${sourceWord} farq qiladi`} />}
                    <span className={clsx("shrink-0 text-[13px] tabular-nums", active ? "text-white/80" : "text-[var(--color-text-muted)]")}>
                      {on}/{fs.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 p-4 md:p-6">
          <label className="flex h-14 items-center gap-3 rounded-full border border-[var(--color-border)] px-5 focus-within:border-[var(--color-text-muted)]">
            <SearchIcon className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hamma bo'limdan qidirish: davomat, kassa, filial…"
              aria-label="Funksiya qidirish"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-subtle)]"
            />
          </label>

          {state.isLoading ? (
            <LoadingState />
          ) : state.isError || !s ? (
            <ErrorState message="Funksiyalarni yuklab bo'lmadi" />
          ) : shown.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-[var(--color-text-muted)]">Hech narsa topilmadi</p>
          ) : (
            shown.map(([g, fs]) => (
              <div key={g} className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[20px] font-medium text-[var(--color-text)]">{g}</h3>
                  {canEdit && !q && (
                    <div className="flex flex-wrap gap-2">
                      <ActionButton onClick={() => setValues(Object.fromEntries(fs.map((f) => [f.key, true])))} icon={<ToggleGlyph on />}>
                        Bo&apos;limni yoqish
                      </ActionButton>
                      <ActionButton onClick={() => setValues(Object.fromEntries(fs.map((f) => [f.key, false])))} icon={<ToggleGlyph on={false} />}>
                        Bo&apos;limni o&apos;chirish
                      </ActionButton>
                      <ActionButton onClick={() => setValues(Object.fromEntries(fs.map((f) => [f.key, null])))} icon={<RefreshIcon className="h-4 w-4" />}>
                        {fromPlan ? "Tarifga qaytarish" : "Umumiyga qaytarish"}
                      </ActionButton>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {fs.map((f) => {
                    const own = valueOf(f.key);
                    const parent = f.parent ? catalog.data?.find((x) => x.key === f.parent) : undefined;
                    const parentOff = !!f.parent && !valueOf(f.parent);
                    const fallback = fallbackOf(f.key);
                    const manual = differs(f.key);
                    const unsaved = f.key in draft;
                    return (
                      <div
                        key={f.key}
                        className={clsx(
                          "flex items-start gap-4 rounded-[22px] border px-5 py-4 transition-colors",
                          manual ? "border-[var(--color-text-muted)]" : "border-[var(--color-border)]",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[16px] font-medium text-[var(--color-text)]">
                            <span className="truncate">{f.label}</span>
                            {unsaved && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-warning)]" title="Saqlanmagan" />}
                          </div>
                          <p className="mt-0.5 text-[13.5px] leading-snug text-[var(--color-text-muted)]">{f.description}</p>
                          <p className="mt-1 text-[12.5px] text-[var(--color-text-subtle)]">
                            {parentOff
                              ? `«${parent?.label ?? "Asosiy bo'lim"}» o'chiq — bu ham ishlamaydi`
                              : manual
                                ? `Qo'lda o'zgartirilgan · ${sourceWord}: ${fallback ? "yoqilgan" : "o'chirilgan"}`
                                : fromPlan
                                  ? fallback
                                    ? "Tarif cheklamaydi"
                                    : "Tarifda yo'q"
                                  : `Butun bog'chadan: ${fallback ? "yoqilgan" : "o'chirilgan"}`}
                          </p>
                        </div>
                        <BigSwitch
                          checked={own && !parentOff}
                          label={f.label}
                          disabled={!canEdit || parentOff || saving}
                          onChange={() => setValues({ [f.key]: !own })}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pastki qator */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-[28px] border-t border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/95 px-6 py-4 backdrop-blur max-md:bottom-[72px] max-md:gap-2 max-md:px-4 max-md:py-3">
        <div className="text-[13.5px] text-[var(--color-text-muted)]">
          {saveError ? (
            <span role="alert" className="text-[var(--color-danger)]">
              {saveError}
            </span>
          ) : dirtyCount > 0 ? (
            <span className="font-medium text-[var(--color-warning)]">{dirtyCount} ta o&apos;zgarish saqlanmagan</span>
          ) : (
            `${differCount} ta funksiya ${sourceWord} farq qiladi`
          )}
          {!canEdit && user && <span className="ml-2">· siz faqat ko&apos;ra olasiz</span>}
        </div>
        {canEdit && (
          <div className="flex gap-3 max-md:w-full">
            <button
              type="button"
              disabled={dirtyCount === 0 || saving}
              onClick={() => {
                setDrafts({});
                setSaveError(null);
              }}
              className="h-12 min-w-[120px] cursor-pointer rounded-full border max-md:h-11 max-md:flex-1 border-[var(--color-border)] px-6 text-[15px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Bekor
            </button>
            <button
              type="button"
              disabled={dirtyCount === 0 || saving}
              onClick={save}
              className="h-12 min-w-[160px] cursor-pointer rounded-full bg-[var(--color-ink)] max-md:h-11 max-md:min-w-0 max-md:flex-1 px-6 text-[15px] font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-[var(--color-border)] disabled:text-white"
            >
              {saving ? "Saqlanmoqda…" : "Saqlash"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-[13.5px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]"
    >
      {icon}
      {children}
    </button>
  );
}

/** Kichik «tumbler» belgisi — bo'limni yoqish/o'chirish tugmalari uchun */
function ToggleGlyph({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="6" />
      <circle cx={on ? 16 : 8} cy="12" r="3" fill={on ? "currentColor" : "none"} />
    </svg>
  );
}

function BigSwitch({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        "relative mt-1 h-8 w-[52px] shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[var(--color-success)]" : "bg-[var(--color-border)]",
      )}
    >
      <span
        className={clsx(
          "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left] duration-200",
          checked ? "left-[24px]" : "left-1",
        )}
      />
    </button>
  );
}
