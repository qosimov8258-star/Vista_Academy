"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, getPaginated } from "@/lib/api";
import type { Child, ChildAllergy, Group } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { canWriteOperational } from "@/lib/permissions";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Faol", INACTIVE: "Nofaol", QUARANTINED: "Karantinda" };
const STATUS_TONE: Record<string, "success" | "neutral" | "danger"> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  QUARANTINED: "danger",
};
const RELATION_LABEL: Record<string, string> = {
  MOTHER: "Onasi",
  FATHER: "Otasi",
  GRANDPARENT: "Buvi/bobo",
  OTHER: "Vasiy",
};

export default function ChildrenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const router = useRouter();

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

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv(`/app/exports/children${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`, "bolalar.csv");
    } catch {
      setExportError("Eksport qilib bo'lmadi — qayta urinib ko'ring");
    } finally {
      setExporting(false);
    }
  };

  const childrenQuery = useQuery({
    queryKey: ["children", slug, page, forcedBranchId, search, groupFilter, statusFilter],
    queryFn: () =>
      getPaginated<Child>(
        `/app/children?page=${page}&limit=20` +
          (forcedBranchId ? `&branchId=${forcedBranchId}` : "") +
          (search ? `&search=${encodeURIComponent(search)}` : "") +
          (groupFilter ? `&groupId=${groupFilter}` : "") +
          (statusFilter ? `&status=${statusFilter}` : ""),
      ),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Bolalar
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">Tarmoqqa ro'yxatga olingan bolalar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            Eksport (CSV)
          </Button>
          {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi bola</Button>}
        </div>
      </div>

      {exportError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {exportError}
        </div>
      )}

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <Card className="grid gap-3 p-4 sm:grid-cols-3 sm:px-6">
        <Input
          placeholder="Ism, ota-ona yoki ID bo'yicha qidirish (masalan id14732)"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <Select
          value={groupFilter}
          onChange={(e) => {
            setPage(1);
            setGroupFilter(e.target.value);
          }}
        >
          <option value="">Barcha guruhlar</option>
          {(groupsQuery.data ?? []).map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
        >
          <option value="">Barcha holatlar</option>
          <option value="ACTIVE">{STATUS_LABEL.ACTIVE}</option>
          <option value="INACTIVE">{STATUS_LABEL.INACTIVE}</option>
          <option value="QUARANTINED">{STATUS_LABEL.QUARANTINED}</option>
        </Select>
      </Card>

      {childrenQuery.isLoading ? (
        <LoadingState rows={6} />
      ) : childrenQuery.isError ? (
        <ErrorState message={(childrenQuery.error as Error).message} />
      ) : !childrenQuery.data || childrenQuery.data.data.length === 0 ? (
        <EmptyState
          title="Bola topilmadi"
          description={
            search || groupFilter || statusFilter
              ? "Qidiruv yoki filtr shartini o'zgartiring"
              : canWrite
                ? "Yangi bola qo'shish uchun tugmani bosing"
                : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <DataTable>
            <THead>
              <tr>
                {/* Surat ustuni — sarlavha matni kerak emas, lekin ekran
                    o'quvchi uchun nomi bo'lsin */}
                <Th className="w-px pr-0">
                  <span className="sr-only">Surat</span>
                </Th>
                <Th>ID</Th>
                <Th>To'liq ism</Th>
                <Th>Ota-ona / aloqa</Th>
                <Th>Tug'ilgan sana</Th>
                {!forcedBranchId && <Th>Filial</Th>}
                <Th>Guruh</Th>
                <Th>Holat</Th>
              </tr>
            </THead>
            <TBody>
              {childrenQuery.data.data.map((child) => (
                <Tr key={child.id} {...rowLinkProps(`/${slug}/children/${child.id}`, (href) => router.push(href))}>
                  <Td className="w-px pr-0">
                    <ChildPhoto child={child} size={36} fallback={initials(child.fullName)} />
                  </Td>
                  <Td>
                    <span className="font-mono text-[12.5px] tabular-nums text-[var(--color-text-muted)]">
                      {formatChildId(child.publicId)}
                    </span>
                  </Td>
                  <Td className="font-medium">
                    <Link href={`/${slug}/children/${child.id}`} className="text-[var(--color-primary)] hover:underline">
                      {child.fullName}
                    </Link>
                    {allergyChildIds.has(child.id) && (
                      <Badge tone="danger" className="ml-2">
                        Allergiya
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {child.guardians?.[0] ? (
                      <>
                        <p className="font-medium text-[var(--color-text)]">{child.guardians[0].guardian.fullName}</p>
                        <p className="mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                          {RELATION_LABEL[child.guardians[0].relation]} • {child.guardians[0].guardian.phone}
                        </p>
                      </>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
                  </Td>
                  <Td className="tabular-nums text-[var(--color-text-muted)]">
                    {child.birthDate ? formatDate(child.birthDate) : "—"}
                  </Td>
                  {!forcedBranchId && (
                    <Td nowrap className="text-[var(--color-text-muted)]">
                      {child.branch?.name ?? "—"}
                    </Td>
                  )}
                  <Td nowrap className="text-[var(--color-text-muted)]">
                    {child.group?.name ?? "—"}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[child.status]}>{STATUS_LABEL[child.status]}</Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>

          <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 text-[12.5px] text-[var(--color-text-muted)] sm:px-6">
            <span className="tabular-nums">
              Jami {childrenQuery.data.meta.total} ta, {childrenQuery.data.meta.page}-sahifa
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Oldingi
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * childrenQuery.data.meta.limit >= childrenQuery.data.meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Keyingi
              </Button>
            </div>
          </div>
        </Card>
      )}

      {canWrite && <CreateChildModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
    </div>
  );
}
