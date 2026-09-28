"use client";

import { use, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, getPaginated } from "@/lib/api";
import type { AuditActor, AuditLogEntry } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { initials } from "@/components/ui/avatar";
import { SelectMenu } from "@/components/ui/select-menu";
import { ErrorState } from "@/components/ui/states";
import type { IconProps } from "@/components/ui/icons";
import {
  AuditIcon,
  BriefcaseIcon,
  BuildingIcon,
  ChecklistIcon,
  ChildIcon,
  CloseIcon,
  GroupIcon,
  KeyIcon,
  MoneyIcon,
  NoteIcon,
  SearchIcon,
  TeacherIcon,
} from "@/components/ui/icons";

const PAGE_SIZE = 30;
const TZ = "Asia/Tashkent";

/** Bo'limlar — bir bo'limga bir nechta yozuv turi kirishi mumkin */
const CATEGORIES: { key: string; label: string; types: string[] }[] = [
  { key: "all", label: "Barchasi", types: [] },
  { key: "children", label: "Bolalar", types: ["Child"] },
  { key: "health", label: "Sog'liq", types: ["Vaccination"] },
  { key: "groups", label: "Guruhlar", types: ["Group"] },
  { key: "employees", label: "Xodimlar", types: ["Employee"] },
  { key: "finance", label: "Moliya", types: ["Payment", "Invoice", "PayrollEntry"] },
  { key: "accounts", label: "Hisoblar", types: ["TenantUser"] },
  { key: "branches", label: "Filiallar", types: ["Branch"] },
];

const PERIODS = [
  { key: "today", label: "Bugun", days: 1 },
  { key: "7d", label: "7 kun", days: 7 },
  { key: "30d", label: "30 kun", days: 30 },
  { key: "all", label: "Hammasi", days: 0 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const ENTITY_ICON: Record<string, React.ComponentType<IconProps>> = {
  Child: ChildIcon,
  Vaccination: ChecklistIcon,
  Group: GroupIcon,
  Employee: TeacherIcon,
  Payment: MoneyIcon,
  Invoice: NoteIcon,
  PayrollEntry: BriefcaseIcon,
  TenantUser: KeyIcon,
  Branch: BuildingIcon,
};

type Tone = "create" | "update" | "delete" | "money" | "security" | "neutral";

/** Amal turi (action'ning nuqtadan keyingi qismi) — belgi matni va rangi */
const VERB: Record<string, { label: string; tone: Tone }> = {
  create: { label: "Qo'shildi", tone: "create" },
  update: { label: "O'zgartirildi", tone: "update" },
  delete: { label: "O'chirildi", tone: "delete" },
  record: { label: "To'lov", tone: "money" },
  refund: { label: "Qaytarildi", tone: "delete" },
  mark_paid: { label: "To'landi", tone: "money" },
  generate: { label: "Hisoblandi", tone: "money" },
  convert: { label: "Qabul qilindi", tone: "create" },
  password_regenerate: { label: "Parol yangilandi", tone: "security" },
  account_open: { label: "Kabinet ochildi", tone: "security" },
};

const TONE: Record<Tone, { badge: string; tile: string }> = {
  create: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", tile: "bg-emerald-50 text-emerald-600" },
  update: { badge: "bg-sky-50 text-sky-700 ring-sky-600/15", tile: "bg-sky-50 text-sky-600" },
  delete: { badge: "bg-rose-50 text-rose-700 ring-rose-600/15", tile: "bg-rose-50 text-rose-600" },
  money: { badge: "bg-amber-50 text-amber-800 ring-amber-600/20", tile: "bg-amber-50 text-amber-600" },
  security: { badge: "bg-violet-50 text-violet-700 ring-violet-600/15", tile: "bg-violet-50 text-violet-600" },
  neutral: { badge: "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] ring-black/5", tile: "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]" },
};

const verbOf = (action: string) => VERB[action.split(".").pop() ?? ""] ?? { label: "Amal", tone: "neutral" as Tone };

const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const shiftDay = (key: string, days: number) =>
  new Date(Date.parse(`${key}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// Brauzerlar o'zbekcha sana nomlarini to'liq bilmaydi ("M09" chiqaradi) — o'zimiz
const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

function dayTitle(key: string): string {
  const today = todayKey();
  const d = new Date(`${key}T12:00:00Z`);
  const full = `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}${key.slice(0, 4) === today.slice(0, 4) ? "" : ` ${key.slice(0, 4)}`}`;
  if (key === today) return `Bugun · ${full}`;
  if (key === shiftDay(today, -1)) return `Kecha · ${full}`;
  return `${WEEKDAYS[d.getUTCDay()]} · ${full}`;
}

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/**
 * Audit — tizimda kim, qachon, nima qilgani. Direktor tarmoq bo'yicha
 * (filial tanlab) yoki filial ichida faqat o'sha filialni ko'radi; filial
 * admini — faqat o'z filialini (cheklov serverda).
 *
 * Lenta kunlar bo'yicha guruhlanadi; har bir yozuvda amal turi rangli
 * belgi bilan, bajargan kishi, vaqt va (tarmoq ko'rinishida) filial.
 */
export default function AuditLogsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const { branchSlug, branchId: forcedBranchId, branch: forcedBranch, branches } = useBranchContext(slug);
  const networkView = user?.role === "NETWORK_ADMIN" && !branchSlug;
  // Filial ichida — filial aniqlanmaguncha so'rov yuborilmaydi, aks holda bir
  // lahza butun tarmoq amallari ko'rinib qolardi
  const ready = !branchSlug || !!forcedBranchId;

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [category, setCategory] = useState("all");
  const [actorId, setActorId] = useState("");
  const [branchId, setBranchId] = useState("");

  // Qidiruv har harfda emas, yozib bo'lgach yuboriladi
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const effectiveBranchId = forcedBranchId ?? (networkView && branchId ? branchId : "");

  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (effectiveBranchId) p.set("branchId", effectiveBranchId);
    const cat = CATEGORIES.find((c) => c.key === category);
    if (cat && cat.types.length) p.set("entityTypes", cat.types.join(","));
    const days = PERIODS.find((x) => x.key === period)?.days ?? 0;
    if (days) {
      const today = todayKey();
      p.set("from", shiftDay(today, -(days - 1)));
      p.set("to", today);
    }
    if (q) p.set("q", q);
    return p;
  }, [effectiveBranchId, category, period, q]);

  const listParams = useMemo(() => {
    const p = new URLSearchParams(filterParams);
    if (actorId) p.set("actorUserId", actorId);
    return p.toString();
  }, [filterParams, actorId]);

  const logsQuery = useInfiniteQuery({
    queryKey: ["audit-logs", slug, listParams],
    queryFn: ({ pageParam }) => getPaginated<AuditLogEntry>(`/app/audit-logs?page=${pageParam}&limit=${PAGE_SIZE}&${listParams}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.limit < last.meta.total ? last.meta.page + 1 : undefined),
    placeholderData: (prev) => prev,
    enabled: ready,
  });

  const actorsQuery = useQuery({
    queryKey: ["audit-actors", slug, filterParams.toString()],
    queryFn: () => api.get<AuditActor[]>(`/app/audit-logs/actors?${filterParams.toString()}`),
    placeholderData: (prev) => prev,
    enabled: ready,
  });

  const entries = useMemo(() => logsQuery.data?.pages.flatMap((p) => p.data) ?? [], [logsQuery.data]);
  const total = logsQuery.data?.pages[0]?.meta.total ?? 0;

  const groups = useMemo(() => {
    const map = new Map<string, AuditLogEntry[]>();
    for (const e of entries) {
      const key = dayKey(e.createdAt);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()];
  }, [entries]);

  const filtered = category !== "all" || !!actorId || !!q || period !== "30d" || (networkView && !!branchId);
  const resetFilters = () => {
    setSearch("");
    setQ("");
    setCategory("all");
    setActorId("");
    setBranchId("");
    setPeriod("30d");
  };

  const actorOptions = [
    { value: "", label: "Barcha xodimlar" },
    ...(actorsQuery.data ?? [])
      .filter((a) => a.actorUserId)
      .map((a) => ({ value: a.actorUserId as string, label: `${a.actorName} · ${a.count}` })),
  ];
  const branchOptions = [{ value: "", label: "Barcha filiallar" }, ...branches.map((b) => ({ value: b.id, label: b.name }))];

  return (
    <div className="mx-auto w-full max-w-[1040px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#0d241b] text-emerald-300 shadow-[0_10px_24px_-12px_rgba(5,40,28,0.55)]">
            <AuditIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-[24px] font-bold tracking-[var(--tracking-title)] text-[var(--color-text)]">Audit</h1>
            <p className="text-[14px] text-[var(--color-text-muted)]">
              {forcedBranch ? `${forcedBranch.name} — ` : ""}kim, qachon va nima qilgani
            </p>
          </div>
        </div>
        {!logsQuery.isLoading && (
          <span className="rounded-full bg-[var(--color-surface)] px-3.5 py-1.5 text-[13px] font-semibold tabular-nums text-[var(--color-text-muted)] shadow-[var(--shadow-xs)] ring-1 ring-black/[0.04]">
            {total.toLocaleString("uz-UZ")} ta amal
          </span>
        )}
      </div>

      {/* Filtrlar */}
      <div className="space-y-3.5 rounded-[var(--radius-xl)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className={clsx("grid gap-3", networkView ? "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]" : "md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}>
          <label className="relative block">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Amal yoki ism bo'yicha qidirish"
              className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] pl-10 pr-10 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--color-text-muted)]/60 focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Qidiruvni tozalash"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-black/[0.05]"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </label>
          <SelectMenu options={actorOptions} value={actorId} onChange={setActorId} />
          {networkView && <SelectMenu options={branchOptions} value={branchId} onChange={setBranchId} />}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={category === c.key}
                onClick={() => setCategory(c.key)}
                className={clsx(
                  "h-9 shrink-0 cursor-pointer rounded-full px-4 text-[13.5px] font-semibold transition-colors",
                  category === c.key
                    ? "bg-[#0d241b] text-emerald-200"
                    : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 rounded-full bg-[var(--color-surface-sunken)] p-1" role="radiogroup" aria-label="Davr">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={period === p.key}
                onClick={() => setPeriod(p.key)}
                className={clsx(
                  "h-8 flex-1 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                  period === p.key ? "bg-white text-[var(--color-text)] shadow-[var(--shadow-xs)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lenta */}
      {!ready || logsQuery.isLoading ? (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-xs)]" />
          ))}
        </div>
      ) : logsQuery.isError ? (
        <ErrorState message={(logsQuery.error as Error).message} />
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center rounded-[var(--radius-xl)] bg-[var(--color-surface)] px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]">
            <AuditIcon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-[16px] font-semibold text-[var(--color-text)]">
            {filtered ? "Filtrga mos amal topilmadi" : "Hali amal yozilmagan"}
          </p>
          <p className="mt-1 max-w-[360px] text-[14px] text-[var(--color-text-muted)]">
            {filtered
              ? "Boshqa davr yoki bo'limni tanlab ko'ring."
              : "Bola, xodim, guruh, to'lov va hisoblar bilan bog'liq amallar shu yerda paydo bo'ladi."}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 h-10 cursor-pointer rounded-full bg-[var(--color-surface-sunken)] px-5 text-[14px] font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-border)]"
            >
              Filtrlarni tozalash
            </button>
          )}
        </div>
      ) : (
        <div className={clsx("space-y-6 transition-opacity", logsQuery.isFetching && !logsQuery.isFetchingNextPage && "opacity-60")}>
          {groups.map(([key, items]) => (
            <section key={key}>
              <h2 className="mb-2.5 flex items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                {dayTitle(key)}
                <span className="rounded-full bg-[var(--color-surface-sunken)] px-2 py-0.5 text-[11.5px] tabular-nums tracking-normal">{items.length}</span>
              </h2>
              <ol className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
                {items.map((entry, i) => {
                  const verb = verbOf(entry.action);
                  const tone = TONE[verb.tone];
                  const Icon = ENTITY_ICON[entry.entityType] ?? NoteIcon;
                  return (
                    <li
                      key={entry.id}
                      className={clsx("flex items-start gap-3.5 px-4 py-3.5 sm:px-5", i > 0 && "border-t border-[var(--color-separator)]")}
                    >
                      <span className={clsx("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]", tone.tile)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] leading-snug text-[var(--color-text)]">{entry.summary}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[var(--color-text-muted)]">
                          {/* Telefonda amal belgisi shu qatorda — matn uchun joy qoladi */}
                          <span className={clsx("rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 sm:hidden", tone.badge)}>{verb.label}</span>
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-text)]">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0d241b] text-[9px] font-bold text-emerald-300">
                              {initials(entry.actorName)}
                            </span>
                            {entry.actorName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={entry.createdAt} className="tabular-nums">
                            {timeOf(entry.createdAt)}
                          </time>
                          {networkView && entry.branch?.name && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1">
                                <BuildingIcon className="h-3.5 w-3.5" />
                                {entry.branch.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={clsx("hidden shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 sm:inline-flex", tone.badge)}>{verb.label}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}

          {logsQuery.hasNextPage && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => logsQuery.fetchNextPage()}
                disabled={logsQuery.isFetchingNextPage}
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[var(--color-surface)] px-6 text-[14px] font-semibold text-[var(--color-text)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-60"
              >
                {logsQuery.isFetchingNextPage && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                Yana yuklash
                <span className="tabular-nums text-[var(--color-text-muted)]">({(total - entries.length).toLocaleString("uz-UZ")})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
