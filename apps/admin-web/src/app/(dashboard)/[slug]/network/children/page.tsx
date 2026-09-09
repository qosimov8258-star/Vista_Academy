"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, getPaginated } from "@/lib/api";
import type { Child, Group, Organization } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { formatChildId, formatDate } from "@/lib/format";
import { monogram, paletteFor } from "@/features/network/palette";

const PAGE_SIZE = 24;
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Faol", INACTIVE: "Nofaol", QUARANTINED: "Karantinda" };
const STATUS_TONE: Record<string, "success" | "neutral" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  QUARANTINED: "danger",
};

/**
 * Super Admin uchun tarmoq bo'ylab o'quvchilar: barcha filiallarniki bir
 * ro'yxatda, filial va guruh bo'yicha filtr bilan. Filial darajasidagi
 * `/{slug}/children` sahifasi o'zgarishsiz qoladi.
 */
export default function NetworkChildrenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [groupId, setGroupId] = useState("");

  // Har harfda so'rov ketmasin — yozish to'xtaganda qidiriladi
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const groupsQuery = useQuery({
    queryKey: ["network-groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
  });

  const branches = orgQuery.data?.branches ?? [];
  const groups = useMemo(
    () => (groupsQuery.data ?? []).filter((g) => !branchId || g.branchId === branchId),
    [groupsQuery.data, branchId],
  );

  const childrenQuery = useQuery({
    queryKey: ["network-children", slug, page, search, branchId, groupId],
    queryFn: () =>
      getPaginated<Child>(
        `/app/children?page=${page}&limit=${PAGE_SIZE}` +
          (search ? `&search=${encodeURIComponent(search)}` : "") +
          (branchId ? `&branchId=${branchId}` : "") +
          (groupId ? `&groupId=${groupId}` : ""),
      ),
    placeholderData: (prev) => prev,
  });

  const total = childrenQuery.data?.meta.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = childrenQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">O&apos;quvchilar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Tarmoqdagi barcha bolalar bir ro&apos;yxatda</p>
        </div>
        {childrenQuery.data && (
          <p className="text-sm text-[var(--color-text-muted)]">
            <b className="text-[var(--color-text)]">{total}</b> ta topildi
          </p>
        )}
      </div>

      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <Input
          placeholder="Ism, ota-ona yoki ID (masalan id14732)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-10 rounded-xl"
        />
        <Select
          value={branchId}
          onChange={(e) => {
            setBranchId(e.target.value);
            setGroupId("");
            setPage(1);
          }}
          className="h-10 rounded-xl"
        >
          <option value="">Barcha filiallar</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </Select>
        <Select
          value={groupId}
          onChange={(e) => {
            setGroupId(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl"
        >
          <option value="">Barcha guruhlar</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </Card>

      {childrenQuery.isLoading ? (
        <LoadingState />
      ) : childrenQuery.isError ? (
        <ErrorState message={(childrenQuery.error as Error).message} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Bola topilmadi"
          description={search || branchId || groupId ? "Filtrlarni o'zgartirib ko'ring" : undefined}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((child) => {
              const palette = child.group ? paletteFor(child.group.id) : null;
              return (
                <Link
                  key={child.id}
                  href={`/${slug}/children/${child.id}`}
                  className="flex items-center gap-3 rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(16,24,40,0.18)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span
                    className={clsx(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      child.gender === "MALE"
                        ? "bg-sky-50 text-sky-700"
                        : child.gender === "FEMALE"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
                    )}
                  >
                    {monogram(child.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--color-text)]">{child.fullName}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {formatChildId(child.publicId)}
                      {child.branch && ` · ${child.branch.name}`}
                      {child.birthDate && ` · ${formatDate(child.birthDate)}`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {child.group ? (
                        <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-medium", palette!.chip)}>
                          {child.group.name}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-warning)]">
                          Guruhsiz
                        </span>
                      )}
                      {child.status !== "ACTIVE" && (
                        <Badge tone={STATUS_TONE[child.status]}>{STATUS_LABEL[child.status]}</Badge>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">
                {page}-sahifa, jami {lastPage}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Oldingi
                </Button>
                <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                  Keyingi
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
