"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPaginated } from "@/lib/api";
import type { Child } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsv(`/app/exports/children${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`, "bolalar.csv");
    } finally {
      setExporting(false);
    }
  };

  const childrenQuery = useQuery({
    queryKey: ["children", slug, page, forcedBranchId, search],
    queryFn: () =>
      getPaginated<Child>(
        `/app/children?page=${page}&limit=20` +
          (forcedBranchId ? `&branchId=${forcedBranchId}` : "") +
          (search ? `&search=${encodeURIComponent(search)}` : ""),
      ),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Bolalar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Tarmoqqa ro'yxatga olingan bolalar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" loading={exporting} onClick={handleExport}>
            Eksport (CSV)
          </Button>
          {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi bola</Button>}
        </div>
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <Card className="p-4">
        <Input
          placeholder="Ism, ota-ona yoki ID bo'yicha qidirish (masalan id14732)"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="sm:max-w-md"
        />
      </Card>

      {childrenQuery.isLoading ? (
        <LoadingState />
      ) : childrenQuery.isError ? (
        <ErrorState message={(childrenQuery.error as Error).message} />
      ) : !childrenQuery.data || childrenQuery.data.data.length === 0 ? (
        <EmptyState
          title="Bola topilmadi"
          description={
            search
              ? "Qidiruv shartini o'zgartiring"
              : canWrite
                ? "Yangi bola qo'shish uchun tugmani bosing"
                : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">To'liq ism</th>
                  <th className="px-5 py-3 font-medium">Ota-ona / aloqa</th>
                  <th className="px-5 py-3 font-medium">Tug'ilgan sana</th>
                  {!forcedBranchId && <th className="px-5 py-3 font-medium">Filial</th>}
                  <th className="px-5 py-3 font-medium">Guruh</th>
                  <th className="px-5 py-3 font-medium">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {childrenQuery.data.data.map((child) => (
                  <tr key={child.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs text-[var(--color-text-muted)]">
                        {formatChildId(child.publicId)}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">
                      <Link href={`/${slug}/children/${child.id}`} className="text-[var(--color-primary)] hover:underline">
                        {child.fullName}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      {child.guardians?.[0] ? (
                        <>
                          <p className="text-[var(--color-text)]">{child.guardians[0].guardian.fullName}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {RELATION_LABEL[child.guardians[0].relation]} • {child.guardians[0].guardian.phone}
                          </p>
                        </>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">
                      {child.birthDate ? formatDate(child.birthDate) : "—"}
                    </td>
                    {!forcedBranchId && (
                      <td className="px-5 py-3 text-[var(--color-text-muted)]">{child.branch?.name ?? "—"}</td>
                    )}
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{child.group?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge tone={STATUS_TONE[child.status]}>{STATUS_LABEL[child.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-text-muted)]">
            <span>
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
