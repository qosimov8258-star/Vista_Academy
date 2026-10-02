"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TopbarAction } from "@/components/layout/topbar-action";
import { api, getPaginated } from "@/lib/api";
import type { Child, ChildAllergy, Group } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhoneIcon } from "@/components/ui/icons";
import { DataTable, THead, TBody, Tr, Th, Td, rowLinkProps } from "@/components/ui/table";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { formatChildId, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/download";
import { useBranchContext } from "@/lib/use-branch-context";
import { CreateChildModal } from "@/features/children/create-child-modal";
import { EditChildModal } from "@/features/children/edit-child-modal";
import { TeacherChildren } from "@/features/teacher/teacher-children";
import { canWriteOperational, isTeacher } from "@/lib/permissions";
import { useTr } from "@/i18n/tr";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Faol", INACTIVE: "Nofaol", QUARANTINED: "Karantinda" };
const STATUS_TONE: Record<string, "success" | "neutral" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  QUARANTINED: "danger",
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PAID: "To'liq to'langan",
  PARTIAL: "Yarim to'langan",
  UNPAID: "Umuman to'lamagan",
};
const RELATION_LABEL: Record<string, string> = {
  MOTHER: "Onasi",
  FATHER: "Otasi",
  GRANDPARENT: "Buvi/bobo",
  OTHER: "Vasiy",
};

type ChildrenFinanceStats = { paid: number; partial: number; unpaid: number; stopped: number };

/** Tarbiyachi telefon uchun qilingan o'z ro'yxatini oladi, qolgan rollar — jadvalni. */
export default function ChildrenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState rows={6} />;
  if (isTeacher(user?.role)) return <TeacherChildren slug={slug} />;
  return <BranchChildren slug={slug} />;
}

function BranchChildren({ slug }: { slug: string }) {
  const tr = useTr();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  // Tarbiyachiga bitta guruh biriktiriladi — guruh filtri, guruh va filial ustuni unga keraksiz.
  const teacher = isTeacher(user?.role);
  const { branchId: forcedBranchId, branchSlug, base } = useBranchContext(slug);
  const router = useRouter();
  // Moliyachi shu ro'yxatdan o'quvchini bosganda to'liq profilga emas, faqat
  // to'lovlar va moliyaviy tarix ko'rinadigan alohida sahifaga o'tadi —
  // rivojlanish, sog'liq va shu kabi bo'limlar moliyachiga aloqasi yo'q.
  const isFinance = user?.role === "FINANCE";
  const childHref = (childId: string) =>
    isFinance
      ? branchSlug
        ? `/${slug}/${branchSlug}/finance/${childId}`
        : `/${slug}/finance/${childId}`
      : `${base}/children/${childId}`;

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  // Ro'yxatni skanerlayotgan xodim allergiyasi bor bolani bir qarashda
  // ko'rsin — har bir qatorni ochib ko'rishning hojati qolmaydi.
  const allergiesQuery = useQuery({
    queryKey: ["child-allergies", slug, forcedBranchId],
    queryFn: () => api.get<ChildAllergy[]>(`/app/health/allergies${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const allergyChildIds = new Set((allergiesQuery.data ?? []).map((a) => a.child.id));

  // Moliyachi yozish huquqiga ega emas — "faqat ko'rish" ogohlantirishi
  // o'rniga unga foydali bo'lgan to'lov statistikasi ko'rsatiladi.
  const financeStatsQuery = useQuery({
    queryKey: ["children-finance-stats", slug, forcedBranchId],
    queryFn: () =>
      api.get<ChildrenFinanceStats>(
        `/app/children/finance-stats${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`,
      ),
    enabled: isFinance,
  });

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv(`/app/exports/children${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`, "bolalar.csv");
    } catch {
      setExportError(tr("Eksport qilib bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setExporting(false);
    }
  };

  const childrenQuery = useQuery({
    queryKey: ["children", slug, page, forcedBranchId, search, groupFilter, statusFilter, isFinance],
    queryFn: () =>
      getPaginated<Child>(
        `/app/children?page=${page}&limit=20` +
          (forcedBranchId ? `&branchId=${forcedBranchId}` : "") +
          (search ? `&search=${encodeURIComponent(search)}` : "") +
          (groupFilter ? `&groupId=${groupFilter}` : "") +
          (statusFilter ? (isFinance ? `&paymentStatus=${statusFilter}` : `&status=${statusFilter}`) : ""),
      ),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Mobilda: "Eksport" yuqori panelda (uch chiziq qatorida), "+ Yangi bola" sarlavha qatorining o'ngida.
            Kompyuterda ikkalasi avvalgidek o'ng tomonda yonma-yon. */}
        <div className="flex w-full items-start justify-between gap-3 md:w-auto">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
              {tr("Bolalar")}
            </h1>
            <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">{tr("Tarmoqqa ro'yxatga olingan bolalar")}</p>
          </div>
          {canWrite && (
            <div className="shrink-0 md:hidden">
              <Button onClick={() => setCreateOpen(true)}>{tr("+ Yangi bola")}</Button>
            </div>
          )}
        </div>
        <TopbarAction>
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            {tr("Eksport (CSV)")}
          </Button>
        </TopbarAction>
        <div className="hidden gap-2 md:flex">
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            {tr("Eksport (CSV)")}
          </Button>
          {canWrite && <Button onClick={() => setCreateOpen(true)}>{tr("+ Yangi bola")}</Button>}
        </div>
      </div>

      {exportError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {tr(exportError)}
        </div>
      )}

      {!canWrite && (isFinance ? <ChildrenFinanceStatsBar stats={financeStatsQuery.data} /> : <ViewOnlyNote role={user?.role} />)}

      <Card className={`grid gap-3 p-4 sm:px-6 ${teacher ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <Input
          placeholder={tr("Ism, ota-ona yoki ID bo'yicha qidirish (masalan id14732)")}
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        {!teacher && (
        <Select
          value={groupFilter}
          onChange={(e) => {
            setPage(1);
            setGroupFilter(e.target.value);
          }}
        >
          <option value="">{tr("Barcha guruhlar")}</option>
          {(groupsQuery.data ?? []).map((group) => (
            <option key={group.id} value={group.id}>
              {tr(group.name)}
            </option>
          ))}
        </Select>
        )}
        <Select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          {isFinance ? (
            <>
              <option value="">{tr("Barcha to'lovlar")}</option>
              <option value="PAID">{tr(PAYMENT_STATUS_LABEL.PAID)}</option>
              <option value="PARTIAL">{tr(PAYMENT_STATUS_LABEL.PARTIAL)}</option>
              <option value="UNPAID">{tr(PAYMENT_STATUS_LABEL.UNPAID)}</option>
            </>
          ) : (
            <>
              <option value="">{tr("Barcha holatlar")}</option>
              <option value="ACTIVE">{tr(STATUS_LABEL.ACTIVE)}</option>
              <option value="INACTIVE">{tr(STATUS_LABEL.INACTIVE)}</option>
            </>
          )}
        </Select>
      </Card>

      {childrenQuery.isLoading ? (
        <LoadingState rows={6} />
      ) : childrenQuery.isError ? (
        <ErrorState message={tr((childrenQuery.error as Error).message)} />
      ) : !childrenQuery.data || childrenQuery.data.data.length === 0 ? (
        <EmptyState
          title={tr("Bola topilmadi")}
          description={
            search || groupFilter || statusFilter
              ? tr("Qidiruv yoki filtr shartini o'zgartiring")
              : canWrite
                ? tr("Yangi bola qo'shish uchun tugmani bosing")
                : undefined
          }
        />
      ) : (
        <>
        {/* Telefonda jadval o'rniga kartochkalar: surat, ism, guruh, ota-ona telefoni */}
        <ul className="space-y-3 md:hidden">
          {childrenQuery.data.data.map((child) => {
            const g = child.guardians?.[0];
            return (
              <li key={child.id} className="rounded-[20px] border border-[var(--color-border-hair)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3">
                  <ChildPhoto child={child} size={44} fallback={initials(child.fullName)} />
                  <div className="min-w-0 flex-1">
                    <Link href={childHref(child.id)} className="block truncate text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-text)]">
                      {tr(child.fullName)}
                    </Link>
                    <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">
                      {formatChildId(child.publicId)}
                      {!teacher && child.group?.name ? ` · ${child.group.name}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={STATUS_TONE[child.status]}>{tr(STATUS_LABEL[child.status])}</Badge>
                    {allergyChildIds.has(child.id) && <Badge tone="danger">{tr("Allergiya")}</Badge>}
                  </div>
                </div>
                {g ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-[13px] text-[var(--color-text-muted)]">
                      {tr(RELATION_LABEL[g.relation])} · <span className="font-medium text-[var(--color-text)]">{tr(g.guardian.fullName)}</span>
                    </p>
                    <a
                      href={`tel:${g.guardian.phone}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 text-[14.5px] font-semibold tabular-nums text-[var(--accent-soft-ink)] active:scale-[0.98]"
                    >
                      <PhoneIcon className="h-4 w-4 text-[var(--accent-soft-icon)]" />
                      {tr(g.guardian.phone)}
                    </a>
                  </div>
                ) : null}
                {canWrite && (
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => setEditingChild(child)}>
                      {tr("Tahrirlash")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <Card className="hidden overflow-hidden md:block">
          <DataTable>
            <THead>
              <tr>
                {/* Surat ustuni — sarlavha matni kerak emas, lekin ekran
                    o'quvchi uchun nomi bo'lsin */}
                <Th className="w-px pr-0">
                  <span className="sr-only">{tr("Surat")}</span>
                </Th>
                <Th>{tr("ID")}</Th>
                <Th>{tr("To'liq ism")}</Th>
                <Th>{tr("Ota-ona / aloqa")}</Th>
                <Th>{tr("Tug'ilgan sana")}</Th>
                {!forcedBranchId && !teacher && <Th>{tr("Filial")}</Th>}
                {!teacher && <Th>{tr("Guruh")}</Th>}
                <Th>{tr("Holat")}</Th>
                {canWrite && <Th />}
              </tr>
            </THead>
            <TBody>
              {childrenQuery.data.data.map((child) => (
                <Tr key={child.id} {...rowLinkProps(childHref(child.id), (href) => router.push(href))}>
                  <Td className="w-px pr-0">
                    <ChildPhoto child={child} size={36} fallback={initials(child.fullName)} />
                  </Td>
                  <Td>
                    <span className="font-mono text-[12.5px] tabular-nums text-[var(--color-text-muted)]">
                      {formatChildId(child.publicId)}
                    </span>
                  </Td>
                  <Td className="font-medium">
                    <Link href={childHref(child.id)} className="text-[var(--color-primary)] hover:underline">
                      {tr(child.fullName)}
                    </Link>
                    {allergyChildIds.has(child.id) && (
                      <Badge tone="danger" className="ml-2">
                        {tr("Allergiya")}
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {child.guardians?.[0] ? (
                      <>
                        <p className="font-medium text-[var(--color-text)]">{tr(child.guardians[0].guardian.fullName)}</p>
                        <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                          {tr(RELATION_LABEL[child.guardians[0].relation])} • {tr(child.guardians[0].guardian.phone)}
                        </p>
                      </>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </Td>
                  <Td className="tabular-nums text-[var(--color-text-muted)]">
                    {child.birthDate ? formatDate(child.birthDate) : "—"}
                  </Td>
                  {!forcedBranchId && !teacher && (
                    <Td nowrap className="text-[var(--color-text-muted)]">
                      {child.branch?.name ?? "—"}
                    </Td>
                  )}
                  {!teacher && (
                    <Td nowrap className="text-[var(--color-text-muted)]">
                      {child.group?.name ?? "—"}
                    </Td>
                  )}
                  <Td>
                    <Badge tone={STATUS_TONE[child.status]}>{tr(STATUS_LABEL[child.status])}</Badge>
                  </Td>
                  {canWrite && (
                    <Td className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditingChild(child)}>
                        {tr("Tahrirlash")}
                      </Button>
                    </Td>
                  )}
                </Tr>
              ))}
            </TBody>
          </DataTable>

          <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 text-[12.5px] text-[var(--color-text-muted)] sm:px-6">
            <span className="tabular-nums">
              {tr("Jami")}{" "}{tr(childrenQuery.data.meta.total)} {tr("ta,")}{" "}{tr(childrenQuery.data.meta.page)}{tr("-sahifa")}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {tr("Oldingi")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * childrenQuery.data.meta.limit >= childrenQuery.data.meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                {tr("Keyingi")}
              </Button>
            </div>
          </div>
        </Card>
        <div className="flex items-center justify-between gap-3 text-[12.5px] text-[var(--color-text-muted)] md:hidden">
          <span className="tabular-nums">{tr("Jami")}{" "}{tr(childrenQuery.data.meta.total)} {tr("ta,")}{" "}{tr(childrenQuery.data.meta.page)}{tr("-sahifa")}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{tr("Oldingi")}</Button>
            <Button variant="outline" size="sm" disabled={page * childrenQuery.data.meta.limit >= childrenQuery.data.meta.total} onClick={() => setPage((p) => p + 1)}>{tr("Keyingi")}</Button>
          </div>
        </div>
        </>
      )}

      {canWrite && <CreateChildModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
      {canWrite && editingChild && (
        <EditChildModal open={!!editingChild} onClose={() => setEditingChild(null)} slug={slug} child={editingChild} />
      )}
    </div>
  );
}

/**
 * Moliyachiga "Faqat ko'rish rejimi" ogohlantirishi o'rniga ko'rsatiladi —
 * unga yozish huquqi yo'qligini takrorlashdan ko'ra, shu filialdagi
 * bolalarning to'lov holati bo'yicha taqsimoti foydaliroq.
 */
function ChildrenFinanceStatsBar({ stats }: { stats: ChildrenFinanceStats | undefined }) {
  const tr = useTr();
  const tiles: { label: string; value: number | undefined; toneClass: string }[] = [
    { label: tr("To'lagan"), value: stats?.paid, toneClass: "text-[var(--color-success)]" },
    { label: tr("Yarim to'lagan"), value: stats?.partial, toneClass: "text-[var(--color-warning)]" },
    { label: tr("To'lamagan"), value: stats?.unpaid, toneClass: "text-[var(--color-danger)]" },
    { label: tr("To'xtatgan"), value: stats?.stopped, toneClass: "text-[var(--color-text-muted)]" },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 gap-px bg-[var(--color-separator)] sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-[var(--color-surface)] px-5 py-3.5 sm:px-6">
            <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{tr(tile.label)}</p>
            <p className={`mt-1 text-[20px] font-semibold tabular-nums ${tile.toneClass}`}>
              {tile.value ?? "—"}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
