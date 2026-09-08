"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Branch, TenantUser } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { EditBranchModal } from "@/features/branches/edit-branch-modal";
import { CreateTenantUserModal } from "@/features/users/create-tenant-user-modal";
import { ROLE_LABEL } from "@/lib/permissions";

export default function BranchDetailPage({ params }: { params: Promise<{ slug: string; branchId: string }> }) {
  const { slug, branchId } = use(params);
  const [editOpen, setEditOpen] = useState(false);
  const [assignDirectorOpen, setAssignDirectorOpen] = useState(false);
  const { user: currentUser } = useAuth();

  const { data: branch, isLoading, isError, error } = useQuery({
    queryKey: ["branch", slug, branchId],
    queryFn: () => api.get<Branch>(`/app/organizations/me/branches/${branchId}`),
  });

  const usersQuery = useQuery({
    queryKey: ["tenant-users", slug],
    queryFn: () => api.get<TenantUser[]>("/app/users"),
    enabled: currentUser?.role === "NETWORK_ADMIN",
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!branch) return null;

  const branchTeam = usersQuery.data?.filter((u) => u.branchId === branch.id) ?? [];
  const branchUrl = typeof window !== "undefined" ? `${window.location.origin}/${slug}/${branch.slug}` : `/${slug}/${branch.slug}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${slug}/branches`} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          ← Filiallar
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{branch.name}</h1>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            Tahrirlash
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bu filialning shaxsiy havolasi</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            Filial jamoasi shu havola orqali tizimga kirib, faqat shu filialga tegishli ma&apos;lumotlarni ko&apos;radi.
          </p>
          <div className="rounded-lg border border-[var(--color-border)] bg-gray-50 px-3 py-2">
            <a href={branchUrl} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-[var(--color-primary)] hover:underline">
              {branchUrl}
            </a>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard?.writeText(branchUrl)}
          >
            Havolani nusxalash
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filial ma&apos;lumotlari</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Manzil</p>
            <p className="mt-1 text-sm text-[var(--color-text)]">{branch.address || "Manzil ko'rsatilmagan"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Vaqt zonasi</p>
            <p className="mt-1 text-sm text-[var(--color-text)]">{branch.timezone}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Valyuta</p>
            <p className="mt-1 text-sm text-[var(--color-text)]">{branch.currency}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Yaratilgan sana</p>
            <p className="mt-1 text-sm text-[var(--color-text)]">{formatDate(branch.createdAt)}</p>
          </div>
        </CardBody>
      </Card>

      {currentUser?.role === "NETWORK_ADMIN" && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Filial jamoasi</CardTitle>
            <Button size="sm" onClick={() => setAssignDirectorOpen(true)}>
              + Xodim tayinlash
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {branchTeam.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[var(--color-text-muted)]">
                Bu filialga hali filial admini yoki moliyachi tayinlanmagan
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {branchTeam.map((member) => (
                  <li key={member.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">{member.fullName}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{member.email}</p>
                    </div>
                    <Badge tone="primary">{ROLE_LABEL[member.role]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      <EditBranchModal open={editOpen} onClose={() => setEditOpen(false)} slug={slug} branch={branch} />
      {currentUser && (
        <CreateTenantUserModal
          open={assignDirectorOpen}
          onClose={() => setAssignDirectorOpen(false)}
          slug={slug}
          currentUser={currentUser}
          branches={[branch]}
        />
      )}
    </div>
  );
}
