"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Branch, DashboardSummary, Organization, TenantUser } from "@/lib/types";
import { BranchAvatar } from "@/components/ui/branch-avatar";
import { ErrorState } from "@/components/ui/states";
import type { IconProps } from "@/components/ui/icons";
import {
  BuildingIcon,
  ChevronRightIcon,
  ChildIcon,
  CloseIcon,
  GroupIcon,
  MoneyIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  TeacherIcon,
} from "@/components/ui/icons";
import { CreateBranchModal } from "@/features/branches/create-branch-modal";
import { IosIcon } from "@/features/director/ios-icon";
import { compactMoney, fullMoney } from "@/features/director/money";
import styles from "@/features/director/director-home.module.css";
import { useTr } from "@/i18n/tr";

/**
 * Har bir filialning bosh harfi o'z rangida — bir necha filial bo'lganda
 * ular bir-biriga o'xshab ketmaydi. Rang ma'no tashimaydi (tizim rangidan
 * mustaqil), faqat filialni tanib olishga yordam beradi.
 */
const BRANCH_PALETTE = [
  "bg-gradient-to-b from-emerald-50 to-emerald-100 text-emerald-700",
  "bg-gradient-to-b from-sky-50 to-sky-100 text-sky-700",
  "bg-gradient-to-b from-violet-50 to-violet-100 text-violet-700",
  "bg-gradient-to-b from-amber-50 to-amber-100 text-amber-700",
  "bg-gradient-to-b from-rose-50 to-rose-100 text-rose-600",
  "bg-gradient-to-b from-teal-50 to-teal-100 text-teal-700",
];

const monogram = (name: string) => name.trim()[0]?.toUpperCase() ?? "?";
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

/**
 * Filiallar — bosh sahifa bilan bir uslubda (iOS): katta sarlavha, tarmoq
 * bo'yicha jami vidjetlar, qidiruv va har bir filial uchun katta yumaloq
 * karta. Karta bosilsa — filial ichiga kiriladi, tishli g'ildirak —
 * filial sozlamalari.
 */
export default function BranchesPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: org, isLoading, isError, error } = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const usersQuery = useQuery({
    queryKey: ["tenant-users", slug],
    queryFn: () => api.get<TenantUser[]>("/app/users"),
  });

  const branches = useMemo(() => org?.branches ?? [], [org]);

  // Har bir filial raqamlari alohida so'rov — sekin filial boshqalarini
  // ushlab turmaydi; bosh sahifa bilan bir xil kalit, kesh umumiy.
  const summaryQueries = useQueries({
    queries: branches.map((branch) => ({
      queryKey: ["dashboard-summary", slug, branch.id],
      queryFn: () => api.get<DashboardSummary>(`/app/dashboard/summary?branchId=${branch.id}`),
    })),
  });

  const summaryOf = (branchId: string) => summaryQueries[branches.findIndex((b) => b.id === branchId)];
  const totalsLoading = summaryQueries.some((q) => q.isLoading);
  const total = (pick: (s: DashboardSummary) => number) =>
    summaryQueries.reduce((sum, q) => sum + (q.data ? pick(q.data) : 0), 0);

  const q = search.trim().toLowerCase();
  const visible = q
    ? branches.filter((b) => b.name.toLowerCase().includes(q) || (b.address ?? "").toLowerCase().includes(q))
    : branches;

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-6 pb-4 md:space-y-7">
      {/* Katta sarlavha — iOS "Large Title" */}
      <header className={clsx(styles.rise, "flex items-end justify-between gap-3")}>
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
            {isLoading ? "Tarmoq" : tr("{0} ta filial", branches.length)}
          </p>
          <h1 className="mt-1 text-[30px] font-bold leading-[1.1] tracking-[-0.025em] text-[var(--color-text)] md:text-[34px]">
            {tr("Filiallar")}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label={tr("Filial qo'shish")}
          className="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-3 text-[15px] font-semibold text-white shadow-[var(--shadow-primary)] transition-[transform,filter] duration-200 hover:brightness-110 active:scale-95 md:px-5"
        >
          <PlusIcon className="h-5 w-5" />
          <span className="hidden md:inline">{tr("Filial qo'shish")}</span>
        </button>
      </header>

      {isError ? (
        <ErrorState message={tr((error as Error).message)} />
      ) : (
        <>
          {/* Tarmoq bo'yicha jami */}
          <section className={clsx(styles.rise, "grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4")} style={{ animationDelay: "40ms" }}>
            <Total icon={ChildIcon} label={tr("Bolalar")} value={total((s) => s.childrenCount)} loading={isLoading || totalsLoading} />
            <Total icon={GroupIcon} label={tr("Faol guruhlar")} value={total((s) => s.activeGroupsCount)} loading={isLoading || totalsLoading} />
            <Total icon={TeacherIcon} label={tr("Xodimlar")} value={total((s) => s.employeesCount)} loading={isLoading || totalsLoading} />
            <Total
              icon={MoneyIcon}
              label={tr("Shu oy tushumi")}
              value={compactMoney(total((s) => s.monthRevenue), tr)}
              title={fullMoney(total((s) => s.monthRevenue), tr)}
              suffix="so'm"
              loading={isLoading || totalsLoading}
            />
          </section>

          {/* Qidiruv — iOS uslubida; filial ko'p bo'lganda kerak */}
          {branches.length > 0 && (
            <label className={clsx(styles.rise, "relative block")} style={{ animationDelay: "80ms" }}>
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr("Filial nomi yoki manzili")}
                className="h-12 w-full rounded-[16px] bg-black/[0.05] pl-11 pr-11 text-[16px] text-[var(--color-text)] outline-none transition-[background-color,box-shadow] placeholder:text-[var(--color-text-muted)] focus:bg-[var(--color-surface)] focus:ring-4 focus:ring-[var(--color-primary)]/15"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={tr("Qidiruvni tozalash")}
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[var(--color-text-muted)]/50 text-white"
                >
                  <CloseIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
              )}
            </label>
          )}

          {isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className={clsx(styles.card, "h-[276px] animate-pulse")} />
              ))}
            </div>
          ) : branches.length === 0 ? (
            <div className={clsx(styles.card, "flex flex-col items-center px-6 py-12 text-center")}>
              <IosIcon icon={BuildingIcon} tint="accent" size={60} />
              <p className="mt-5 text-[19px] font-bold text-[var(--color-text)]">{tr("Hali filial yo'q")}</p>
              <p className="mt-1 max-w-[320px] text-[14.5px] text-[var(--color-text-muted)]">
                {tr("Birinchi bog'cha binosini qo'shing — keyin guruh, bola va xodimlarni shu yerdan boshqarasiz.")}
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-6 h-11 cursor-pointer rounded-full bg-[var(--color-primary)] px-6 text-[15px] font-semibold text-white shadow-[var(--shadow-primary)] active:scale-95"
              >
                {tr("Filial qo'shish")}
              </button>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-[var(--color-text-muted)]">
              {tr("&ldquo;")}{search.trim()}{tr("&rdquo; bo'yicha filial topilmadi")}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {visible.map((branch) => {
                const index = branches.findIndex((b) => b.id === branch.id);
                const query = summaryOf(branch.id);
                return (
                  <BranchCard
                    key={branch.id}
                    slug={slug}
                    branch={branch}
                    colorClass={BRANCH_PALETTE[index % BRANCH_PALETTE.length]}
                    manager={usersQuery.data?.find((u) => u.role === "BRANCH_ADMIN" && u.branchId === branch.id) ?? null}
                    managersLoading={usersQuery.isLoading}
                    summary={query?.data}
                    loading={query?.isLoading ?? true}
                    delay={120 + index * 50}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      <CreateBranchModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />
    </div>
  );
}

/** Tarmoq bo'yicha jami — bosh sahifadagi vidjet bilan bir uslubda */
function Total({
  icon,
  label,
  value,
  suffix,
  title,
  loading,
}: {
  icon: React.ComponentType<IconProps>;
  label: string;
  value: number | string;
  suffix?: string;
  title?: string;
  loading?: boolean;
}) {
  const tr = useTr();
  return (
    <div className={clsx(styles.card, "flex flex-col p-4 md:p-5")} title={tr(title)}>
      <IosIcon icon={icon} tint="accent" size={36} />
      <p className="mt-3.5 truncate text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text)] md:text-[26px]">
        {loading ? <span className="inline-block h-6 w-14 animate-pulse rounded-lg bg-[var(--color-surface-sunken)] align-middle" /> : value}
        {/* Telefonda "so'm" sig'maydi — summa title'da to'liq */}
        {!loading && suffix && <span className="ml-1 hidden text-[14px] font-semibold text-[var(--color-text-muted)] md:inline">{tr(suffix)}</span>}
      </p>
      <p className="mt-1.5 text-[13.5px] font-medium text-[var(--color-text-muted)]">{tr(label)}</p>
    </div>
  );
}

function BranchCard({
  slug,
  branch,
  colorClass,
  manager,
  managersLoading,
  summary,
  loading,
  delay,
}: {
  slug: string;
  branch: Branch;
  colorClass: string;
  manager: TenantUser | null;
  managersLoading: boolean;
  summary?: DashboardSummary;
  loading: boolean;
  delay: number;
}) {
  const tr = useTr();
  const children = summary?.childrenCount ?? 0;
  const present = summary?.todayAttendance.present ?? 0;
  const absent = summary?.todayAttendance.absent ?? 0;
  const marked = present + absent;
  const debt = summary?.outstandingDebt ?? 0;
  const revenue = summary?.monthRevenue ?? 0;

  return (
    <article
      className={clsx(
        styles.card,
        styles.rise,
        "group relative flex flex-col overflow-hidden p-5 transition-transform active:scale-[0.99] md:p-6",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Butun karta — filialga kirish; ustidagi tugma z-10 bilan tepada */}
      <Link href={`/${slug}/${branch.slug}`} className="absolute inset-0 z-0 rounded-[inherit]" aria-label={`${branch.name} filialiga kirish`} />

      <div className="pointer-events-none relative z-10 flex items-center gap-3.5 sm:gap-4">
        {/* Belgi qo'yilgan bo'lsa rasm, aks holda nomning bosh harfi */}
        <BranchAvatar
          branch={branch}
          size={52}
          className={clsx("rounded-[18px]! text-[22px] font-bold", !branch.avatarUpdatedAt && colorClass)}
          fallback={monogram(branch.name)}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[18px] font-bold tracking-[-0.015em] text-[var(--color-text)] sm:text-[19px]">{tr(branch.name)}</h2>
          <p className="mt-0.5 truncate text-[14px] text-[var(--color-text-muted)]">{branch.address || tr("Manzil ko'rsatilmagan")}</p>
        </div>
        <Link
          href={`/${slug}/branches/${branch.id}`}
          title={tr("Filial sozlamalari")}
          aria-label={`${branch.name} sozlamalari`}
          className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
        >
          <SettingsIcon className="h-[19px] w-[19px]" />
        </Link>
        {/* Telefonda butun karta bosiladi — strelka nom uchun joyni olmaydi */}
        <ChevronRightIcon className="hidden h-5 w-5 shrink-0 text-[#c4c4c7] transition-transform duration-200 group-hover:translate-x-0.5 sm:block" />
      </div>

      {/* Filial admini */}
      <div className="pointer-events-none relative z-10 mt-4">
        {managersLoading ? (
          <span className="block h-8 w-44 animate-pulse rounded-full bg-[var(--color-surface-sunken)]" />
        ) : manager ? (
          <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-[var(--accent-soft)] py-1 pl-1 pr-3.5 text-[13.5px]">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] font-bold text-white">
              {initials(manager.fullName)}
            </span>
            <span className="truncate font-semibold text-[var(--accent-soft-ink)]">{tr(manager.fullName)}</span>
            <span className="shrink-0 text-[var(--accent-soft-icon)]/80">{tr("· Filial admini")}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-warning-bg)] px-3.5 py-1.5 text-[13.5px] font-semibold text-[var(--color-warning)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />
            {tr("Filial admini tayinlanmagan")}
          </span>
        )}
      </div>

      {/* Raqamlar — iOS guruhlangan plitkalar */}
      <div className="pointer-events-none relative z-10 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label={tr("Bolalar")} value={children} loading={loading} />
        <Tile label={tr("Guruhlar")} value={summary?.activeGroupsCount ?? 0} loading={loading} />
        <Tile label={tr("Xodimlar")} value={summary?.employeesCount ?? 0} loading={loading} />
        <Tile label={tr("Shu oy")} value={compactMoney(revenue, tr)} title={fullMoney(revenue, tr)} loading={loading} />
      </div>

      {/* Bugungi davomat — ingichka chiziq */}
      <div className="pointer-events-none relative z-10 mt-4">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-medium text-[var(--color-text-muted)]">{tr("Bugungi davomat")}</span>
          <span className="tabular-nums text-[var(--color-text-muted)]">
            {loading ? "…" : children === 0 ? tr("bola yo'q") : marked === 0 ? "belgilanmagan" : (
              <>
                <span className="font-semibold text-[var(--color-text)]">{tr(present)}</span> / {children} {tr("keldi")}
              </>
            )}
          </span>
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
          {children > 0 && (
            <>
              <span className="h-full bg-[var(--color-primary)] transition-[width] duration-700" style={{ width: `${(present / children) * 100}%` }} />
              <span className="h-full bg-[var(--color-danger)]/50 transition-[width] duration-700" style={{ width: `${(absent / children) * 100}%` }} />
            </>
          )}
        </div>
      </div>

      {/* Qarzdorlik — bo'lsagina, ogohlantirish sifatida */}
      {!loading && debt > 0 && (
        <div className="pointer-events-none relative z-10 mt-4 flex items-center gap-2.5 rounded-[16px] bg-[var(--color-danger-bg)] px-4 py-2.5" title={fullMoney(debt, tr)}>
          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-danger)]" />
          <span className="flex-1 text-[13.5px] font-medium text-[var(--color-danger)]">{tr("To'lanmagan qarzdorlik")}</span>
          <span className="text-[14px] font-bold tabular-nums text-[var(--color-danger)]">{compactMoney(debt, tr)} {tr("so'm")}</span>
        </div>
      )}
    </article>
  );
}

function Tile({ label, value, title, loading }: { label: string; value: number | string; title?: string; loading?: boolean }) {
  const tr = useTr();
  return (
    <div className="min-w-0 rounded-[18px] bg-[var(--color-surface-sunken)] px-3 py-3" title={tr(title)}>
      {loading ? (
        <span className="block h-5 w-10 animate-pulse rounded-md bg-black/[0.06]" />
      ) : (
        <p className="truncate text-[18px] font-bold leading-tight tracking-[-0.015em] tabular-nums text-[var(--color-text)]">{tr(value)}</p>
      )}
      <p className="mt-0.5 text-[12.5px] font-medium text-[var(--color-text-muted)]">{tr(label)}</p>
    </div>
  );
}
