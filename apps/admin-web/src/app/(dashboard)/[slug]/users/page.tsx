"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Organization, TenantUser, TenantUserRole } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { CreateTenantUserModal } from "@/features/users/create-tenant-user-modal";
import { ROLE_LABEL, canManageUsers } from "@/lib/permissions";
import { BuildingIcon, KeyIcon, SearchIcon } from "@/components/ui/icons";

/**
 * Har bir rol o'z rangida — ro'yxatda kim kimligi bir qarashda ko'rinadi,
 * ustundagi matnni o'qib chiqishning hojati qolmaydi.
 */
const ROLE_STYLE: Record<TenantUserRole, { avatar: string; chip: string; dot: string }> = {
  NETWORK_ADMIN: {
    avatar: "bg-violet-100 text-violet-700",
    chip: "bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
  },
  BRANCH_ADMIN: {
    avatar: "bg-emerald-100 text-emerald-700",
    chip: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  FINANCE: {
    avatar: "bg-amber-100 text-amber-700",
    chip: "bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  MANAGER: {
    avatar: "bg-sky-100 text-sky-700",
    chip: "bg-sky-50 text-sky-700",
    dot: "bg-sky-500",
  },
  TEACHER: {
    avatar: "bg-rose-100 text-rose-600",
    chip: "bg-rose-50 text-rose-600",
    dot: "bg-rose-400",
  },
};

const ROLE_ORDER: TenantUserRole[] = ["NETWORK_ADMIN", "BRANCH_ADMIN", "FINANCE", "MANAGER", "TEACHER"];

function initials(fullName: string): string {
  return (
    fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function PersonRow({ person, isSelf }: { person: TenantUser; isSelf: boolean }) {
  const style = ROLE_STYLE[person.role];

  return (
    <li className="flex items-center gap-3.5 px-4 py-3 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-surface-hover)] sm:px-5">
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${style.avatar}`}
      >
        {initials(person.fullName)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[14px] font-medium text-[var(--color-text)]">{person.fullName}</span>
          {isSelf && <Badge tone="neutral">Siz</Badge>}
          {!person.isActive && <Badge tone="neutral">Nofaol</Badge>}
        </div>
        <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">{person.login}</p>
      </div>

      <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium sm:block ${style.chip}`}>
        {ROLE_LABEL[person.role]}
      </span>
      <span className="hidden shrink-0 text-[12px] tabular-nums text-[var(--color-text-muted)] lg:block">
        {formatDate(person.createdAt)}
      </span>
    </li>
  );
}

export default function UsersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [createOpen, setCreateOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<TenantUserRole | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const { user: currentUser } = useAuth();

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const usersQuery = useQuery({
    queryKey: ["tenant-users", slug],
    queryFn: () => api.get<TenantUser[]>("/app/users"),
  });

  const isSuperAdmin = currentUser?.role === "NETWORK_ADMIN";
  const canCreate = canManageUsers(currentUser?.role);
  const createLabel = isSuperAdmin ? "+ Yangi xodim" : "+ Administrator";

  const people = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const roleCounts = useMemo(() => {
    const counts = new Map<TenantUserRole, number>();
    for (const person of people) {
      counts.set(person.role, (counts.get(person.role) ?? 0) + 1);
    }
    return counts;
  }, [people]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return people.filter((person) => {
      if (roleFilter !== "ALL" && person.role !== roleFilter) return false;
      if (!needle) return true;
      return (
        person.fullName.toLowerCase().includes(needle) || person.login.toLowerCase().includes(needle)
      );
    });
  }, [people, roleFilter, search]);

  /**
   * Ro'yxat filial bo'yicha bo'linadi: Super Adminning asosiy savoli
   * "qaysi filialda kim ishlaydi va kim yetishmayapti" — bunga tekis
   * jadvaldan ko'ra bo'limlarga ajratilgan ro'yxat aniqroq javob beradi.
   */
  const sections = useMemo(() => {
    const branches = orgQuery.data?.branches ?? [];
    const byBranch = branches.map((branch) => ({
      key: branch.id,
      title: branch.name,
      people: visible.filter((person) => person.branchId === branch.id),
      // Filialda admin bor-yo'qligi butun ro'yxat bo'yicha tekshiriladi,
      // aks holda filtr yoqilganda "admin yo'q" deb noto'g'ri ko'rsatilardi
      missingAdmin: !people.some(
        (person) => person.branchId === branch.id && person.role === "BRANCH_ADMIN",
      ),
    }));
    const networkLevel = visible.filter((person) => !person.branchId);
    return { byBranch, networkLevel };
  }, [orgQuery.data, visible, people]);

  const filters: { value: TenantUserRole | "ALL"; label: string; count: number }[] = [
    { value: "ALL", label: "Barchasi", count: people.length },
    ...ROLE_ORDER.filter((role) => roleCounts.has(role)).map((role) => ({
      value: role as TenantUserRole | "ALL",
      label: ROLE_LABEL[role],
      count: roleCounts.get(role) ?? 0,
    })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Sarlavha yon paneldagi havola nomi bilan bir xil bo'lishi kerak:
              Super Adminda "Xodimlar", filial adminida esa u yerda allaqachon
              xodim kartochkalari bo'limi borligi uchun "Administratorlar". */}
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            {isSuperAdmin ? "Xodimlar" : "Administratorlar"}
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
            {isSuperAdmin
              ? "Tizimga kira oladigan xodimlar — filiallar bo'yicha"
              : "O'z filialingiz administratorlari"}
          </p>
        </div>
        {canCreate && <Button onClick={() => setCreateOpen(true)}>{createLabel}</Button>}
      </div>

      {usersQuery.isLoading ? (
        <LoadingState rows={6} />
      ) : usersQuery.isError ? (
        <ErrorState message={(usersQuery.error as Error).message} />
      ) : people.length === 0 ? (
        <EmptyState
          title="Hali xodim yo'q"
          description="Filialga admin yoki moliyachi tayinlash uchun yangi xodim qo'shing"
        />
      ) : (
        <>
          {/* Rol bo'yicha filtr — ayni paytda taqsimotni ham ko'rsatadi */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {filters.map((filter) => {
                const active = roleFilter === filter.value;
                const dot = filter.value === "ALL" ? null : ROLE_STYLE[filter.value as TenantUserRole].dot;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setRoleFilter(filter.value)}
                    aria-pressed={active}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {dot && <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white/70" : dot}`} />}
                    {filter.label}
                    <span className={active ? "text-white/70" : "text-[var(--color-text-muted)]"}>
                      {filter.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative lg:w-64">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ism yoki login"
                aria-label="Xodim qidirish"
                className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] pl-10 pr-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] placeholder:text-[var(--color-text-muted)]/60 focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12] [&::-webkit-search-cancel-button]:appearance-none"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title="Mos xodim topilmadi"
              description="Qidiruv so'zini yoki rol filtrini o'zgartirib ko'ring"
              icon={<SearchIcon className="h-[26px] w-[26px]" />}
            />
          ) : (
            <div className="space-y-3">
              {sections.byBranch.map((section) => (
                <Card key={section.key} className="overflow-hidden">
                  <div className="hairline flex flex-wrap items-center gap-2 border-b border-[var(--color-separator)] px-4 py-3 sm:px-5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      <BuildingIcon className="h-[17px] w-[17px]" />
                    </span>
                    <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
                      {section.title}
                    </h2>
                    <span className="text-[13px] tabular-nums text-[var(--color-text-muted)]">
                      {section.people.length}
                    </span>
                    {section.missingAdmin && (
                      <Badge tone="warning" className="ml-auto">
                        Filial admini tayinlanmagan
                      </Badge>
                    )}
                  </div>
                  {section.people.length === 0 ? (
                    <p className="px-5 py-6 text-center text-[13px] text-[var(--color-text-muted)]">
                      Bu filialda mos xodim yo&apos;q
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--color-separator)]">
                      {section.people.map((person) => (
                        <PersonRow key={person.id} person={person} isSelf={person.id === currentUser?.id} />
                      ))}
                    </ul>
                  )}
                </Card>
              ))}

              {sections.networkLevel.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="hairline flex items-center gap-2 border-b border-[var(--color-separator)] px-4 py-3 sm:px-5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-violet-50 text-violet-600">
                      <KeyIcon className="h-[17px] w-[17px]" />
                    </span>
                    <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
                      Tarmoq darajasi
                    </h2>
                    <span className="text-[13px] tabular-nums text-[var(--color-text-muted)]">
                      {sections.networkLevel.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-[var(--color-separator)]">
                    {sections.networkLevel.map((person) => (
                      <PersonRow key={person.id} person={person} isSelf={person.id === currentUser?.id} />
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {currentUser && canCreate && (
        <CreateTenantUserModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          slug={slug}
          currentUser={currentUser}
          branches={orgQuery.data?.branches ?? []}
        />
      )}
    </div>
  );
}
