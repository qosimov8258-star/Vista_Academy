"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getPaginated } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { useDebounced } from "@/lib/use-debounced";
import type { FeatureDefinition, FeaturePanel, Organization, OrganizationFeatures } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { RefreshIcon, SearchIcon, ShieldIcon } from "@/components/ui/icons";
import { groupFeatures, useFeatureCatalog } from "./use-feature-catalog";
import { OrgPicker } from "./org-picker";

const STORAGE_KEY = "zeeron.dashboard.features-org";
const LEAVE_WARNING = "Saqlanmagan o'zgarishlar yo'qoladi. Davom etilsinmi?";

/** Saqlanmagan o'zgarishlar: doira ("" — butun bog'cha, aks holda panel) → funksiya → qiymat (null — tarifga/umumiyga qaytarish). */
type Drafts = Record<string, Record<string, boolean | null>>;

const featuresUrl = (orgId: string, panel: string) =>
  `/platform/organizations/${orgId}/features${panel ? `?panel=${encodeURIComponent(panel)}` : ""}`;

/**
 * Funksiyalar («Modullar»): yuqorida bog'cha va sozlash doirasi (butun
 * bog'cha yoki bitta panel), chapda bo'limlar, o'ngda shu bo'lim
 * funksiyalari kartalarda. O'zgarishlar avval yig'iladi va pastdagi
 * «Saqlash» bilan birga yoziladi; «Bekor» ularni tashlab yuboradi.
 *
 * Tarif — yuqori chegara: tarifda o'chirilgan funksiya bu yerda yoqilmaydi.
 * Qiymatlar xom xaritalardan (tarif, bog'cha + saqlanmagan o'zgarishlar,
 * panel) hisoblanadi — ekrandagi holat aynan saqlanadigan holat.
 */
export function FeatureModules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === "PLATFORM_SUPER_ADMIN";

  const [org, setOrg] = useState<Organization | null>(null);
  const orgId = org?.id ?? "";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const debouncedOrgSearch = useDebounced(orgSearch.trim(), 300);
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
  // Qidiruv serverda — 100 tadan ko'p bog'cha bo'lsa ham topiladi
  const orgsQuery = useQuery({
    queryKey: ["organizations", "features-picker", debouncedOrgSearch],
    queryFn: () =>
      getPaginated<Organization>(
        `/platform/organizations?limit=100&sort=name${debouncedOrgSearch ? `&search=${encodeURIComponent(debouncedOrgSearch)}` : ""}`,
      ),
    placeholderData: keepPreviousData,
  });
  const organizations = useMemo(() => (orgsQuery.data?.data ?? []).filter((o) => o.status !== "ARCHIVED"), [orgsQuery.data]);
  const scopes = useMemo(() => [{ key: "", label: "Butun bog'cha" }, ...(panelsQuery.data ?? [])], [panelsQuery.data]);

  // Birinchi ochilishda: oxirgi tanlangan bog'cha (ro'yxatda bo'lmasa — alohida so'raladi)
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !orgsQuery.data) return;
    initialized.current = true;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Maxfiy rejim — birinchi bog'cha tanlanadi
    }
    const first = organizations[0] ?? null;
    const hit = organizations.find((o) => o.id === saved);
    if (hit || !saved) {
      setOrg(hit ?? first);
      return;
    }
    api
      .get<Organization>(`/platform/organizations/${saved}`)
      .then((o) => setOrg(o.status !== "ARCHIVED" ? o : first))
      .catch(() => setOrg(first));
  }, [orgsQuery.data, organizations]);

  const state = useQuery({
    queryKey: ["organization-features", orgId, scope],
    queryFn: () => api.get<OrganizationFeatures>(featuresUrl(orgId, scope)),
    enabled: !!orgId,
  });

  const groups = useMemo(() => groupFeatures(catalog.data ?? []), [catalog.data]);
  useEffect(() => {
    if (!group && groups.length) setGroup(groups[0][0]);
  }, [groups, group]);
  const byKey = useMemo(() => new Map((catalog.data ?? []).map((f) => [f.key, f])), [catalog.data]);

  const dirtyCount = Object.values(drafts).reduce((n, d) => n + Object.keys(d).length, 0);
  const dirty = dirtyCount > 0;

  // Saqlanmagan o'zgarish bilan sahifani yopish/yangilash yoki boshqa bo'limga o'tishdan oldin ogohlantirish
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onLinkClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.origin !== window.location.origin) return;
      if (link.pathname === window.location.pathname) return;
      if (!window.confirm(LEAVE_WARNING)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onLinkClick, true);
    };
  }, [dirty]);

  const draft = drafts[scope] ?? {};
  const orgDraft = drafts[""] ?? {};
  const s = state.data;
  const fromPlan = scope === "";
  const blocked = new Set(s?.planBlocked ?? []);
  const isBlocked = (key: string) => blocked.has(key);
  const parentKeysOf = (key: string) => byKey.get(key)?.parents ?? [];
  /** Bog'cha darajasidagi qo'lda qiymat (saqlanmagani bilan); undefined — qo'lda emas */
  const orgManualOf = (key: string): boolean | undefined => {
    if (key in orgDraft) return orgDraft[key] ?? undefined;
    return s?.orgRaw[key];
  };
  /** Shu doirada qo'lda qiymat bo'lmasa olinadigan xom qiymat (ota-ona bo'yicha tarqatilmagan) */
  const fallbackOf = (key: string) => {
    if (isBlocked(key)) return false;
    return fromPlan ? true : (orgManualOf(key) ?? true);
  };
  /** Qo'lda qo'yilgan qiymat (saqlanmagani bilan); undefined — qo'lda emas */
  const manualOf = (key: string): boolean | undefined => {
    if (key in draft) return draft[key] ?? undefined;
    return s && key in s.overrides ? s.overrides[key] : undefined;
  };
  const valueOf = (key: string) => !isBlocked(key) && (manualOf(key) ?? fallbackOf(key));
  /** Asosiy bo'limlarning birortasi o'chiq bo'lsa ichki funksiya ham ishlamaydi (zanjir bo'yicha) */
  const enabledKey = (key: string, depth = 0): boolean =>
    valueOf(key) && (depth > 8 || parentKeysOf(key).every((p) => enabledKey(p, depth + 1)));
  const enabledOf = (f: FeatureDefinition) => enabledKey(f.key);
  const differs = (key: string) => {
    if (isBlocked(key)) return false;
    const m = manualOf(key);
    return m !== undefined && m !== fallbackOf(key);
  };

  /**
   * Qoralama saqlangan qiymatga nisbatan normallashtiriladi: saqlangan
   * qiymatga qaytarilsa — o'zgarish yo'q (mavjud sozlama o'chib ketmaydi);
   * odatiy qiymatga teng bo'lsa — qo'lda sozlama olib tashlanadi.
   * Tarifda yo'q funksiyaga hech qachon true yuborilmaydi.
   */
  const setValues = (values: Record<string, boolean | null>) => {
    if (!s || saving) return;
    setSaveError(null);
    setDrafts((all) => {
      const next = { ...(all[scope] ?? {}) };
      for (const [key, value] of Object.entries(values)) {
        if (value === true && isBlocked(key)) continue;
        const saved = key in s.overrides ? s.overrides[key] : null;
        const wanted = value === null || value === saved ? value : value === fallbackOf(key) ? null : value;
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
    if (!orgId || saving) return;
    const target = orgId;
    const pending = drafts;
    setSaving(true);
    setSaveError(null);
    try {
      // Avval butun bog'cha — panellarning meros qiymati shunga bog'liq
      const order = Object.keys(pending).sort((a, b) => (a === "" ? -1 : b === "" ? 1 : 0));
      for (const panel of order) {
        const res = await api.patch<OrganizationFeatures>(featuresUrl(target, panel), { overrides: pending[panel] });
        // Muvaffaqiyatli qism darhol keshga — keyingisi yiqilsa ham eski qiymat ko'rinmaydi
        queryClient.setQueryData(["organization-features", target, panel], res);
        setDrafts((all) => {
          const out = { ...all };
          delete out[panel];
          return out;
        });
      }
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: ["organization-features", target] });
    }
  };

  const chooseOrg = (id: string) => {
    const next = organizations.find((o) => o.id === id);
    if (!next) return;
    if (id !== orgId && dirty && !window.confirm(LEAVE_WARNING)) return;
    if (id !== orgId) {
      setDrafts({});
      setSaveError(null);
    }
    setOrg(next);
    setPickerOpen(false);
    setOrgSearch("");
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // e'tiborsiz
    }
  };

  if (catalog.isLoading || panelsQuery.isLoading || orgsQuery.isLoading) return <LoadingState />;
  if (catalog.isError || panelsQuery.isError || (orgsQuery.isError && !orgsQuery.data)) return <ErrorState message="Funksiyalarni yuklab bo'lmadi" />;

  const scopeLabel = scopes.find((x) => x.key === scope)?.label ?? "";
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
          total={orgsQuery.data?.meta.total ?? organizations.length}
          selected={org ?? undefined}
          open={pickerOpen}
          disabled={dirty || saving}
          onOpenChange={(v) => {
            setPickerOpen(v);
            if (!v) setOrgSearch("");
          }}
          search={orgSearch}
          onSearch={setOrgSearch}
          searching={orgsQuery.isFetching || orgSearch.trim() !== debouncedOrgSearch}
          filtered={organizations}
          onChoose={chooseOrg}
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
                  disabled={saving}
                  onClick={() => setScope(x.key)}
                  className={clsx(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
                      <ActionButton
                        disabled={saving}
                        onClick={() => setValues(Object.fromEntries(fs.filter((f) => !isBlocked(f.key)).map((f) => [f.key, true])))}
                        icon={<ToggleGlyph on />}
                      >
                        Bo&apos;limni yoqish
                      </ActionButton>
                      <ActionButton
                        disabled={saving}
                        onClick={() => setValues(Object.fromEntries(fs.filter((f) => !isBlocked(f.key)).map((f) => [f.key, false])))}
                        icon={<ToggleGlyph on={false} />}
                      >
                        Bo&apos;limni o&apos;chirish
                      </ActionButton>
                      <ActionButton
                        disabled={saving}
                        onClick={() => setValues(Object.fromEntries(fs.map((f) => [f.key, null])))}
                        icon={<RefreshIcon className="h-4 w-4" />}
                      >
                        {fromPlan ? "Tarifga qaytarish" : "Umumiyga qaytarish"}
                      </ActionButton>
                    </div>
                  )}
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {fs.map((f) => {
                    const own = valueOf(f.key);
                    const planOff = isBlocked(f.key);
                    const offParents = f.parents.filter((p) => !enabledKey(p));
                    const parentOff = offParents.length > 0;
                    const offParentLabels = offParents.map((p) => `«${byKey.get(p)?.label ?? "Asosiy bo'lim"}»`).join(", ");
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
                            {planOff
                              ? "Tarifda yo'q"
                              : parentOff
                              ? `${offParentLabels} o'chiq — bu ham ishlamaydi`
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
                          disabled={!canEdit || planOff || parentOff || saving}
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

function ActionButton({
  onClick,
  icon,
  children,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-[13.5px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
