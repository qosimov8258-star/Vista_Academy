"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { Branch, TenantUser } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDate } from "@/lib/format";
import { initials } from "@/components/ui/avatar";
import { EditBranchModal } from "@/features/branches/edit-branch-modal";
import { CreateTenantUserModal } from "@/features/users/create-tenant-user-modal";
import { EditTenantUserModal } from "@/features/users/edit-tenant-user-modal";
import { ROLE_LABEL, canManageUser } from "@/lib/permissions";
import {
  ArrowLeftIcon,
  BuildingIcon,
  CheckIcon,
  CopyIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  TeacherIcon,
  TrashIcon,
  UnlockIcon,
} from "@/components/ui/icons";

/** Har bir rolga o'z rangi — ilgari hammasi bir xil chipda edi. */
const ROLE_TONE: Record<string, string> = {
  NETWORK_ADMIN: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  BRANCH_ADMIN: "bg-sky-50 text-sky-700",
  FINANCE: "bg-amber-50 text-amber-700",
  MANAGER: "bg-violet-50 text-violet-700",
  TEACHER: "bg-emerald-50 text-emerald-700",
};

export default function BranchDetailPage({ params }: { params: Promise<{ slug: string; branchId: string }> }) {
  const { slug, branchId } = use(params);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [editBranchOpen, setEditBranchOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editMember, setEditMember] = useState<TenantUser | null>(null);
  const [blockMember, setBlockMember] = useState<TenantUser | null>(null);
  const [deleteMember, setDeleteMember] = useState<TenantUser | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: branch, isLoading, isError, error } = useQuery({
    queryKey: ["branch", slug, branchId],
    queryFn: () => api.get<Branch>(`/app/organizations/me/branches/${branchId}`),
  });

  const usersQuery = useQuery({
    queryKey: ["tenant-users", slug],
    queryFn: () => api.get<TenantUser[]>("/app/users"),
    enabled: currentUser?.role === "NETWORK_ADMIN",
  });

  const invalidateTeam = () => {
    queryClient.invalidateQueries({ queryKey: ["tenant-users", slug] });
    queryClient.invalidateQueries({ queryKey: ["employees", slug] });
  };

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      api.patch<TenantUser>(`/app/users/${vars.id}/status`, { isActive: vars.isActive }),
    onSuccess: () => {
      invalidateTeam();
      setBlockMember(null);
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/users/${id}`),
    onSuccess: () => {
      invalidateTeam();
      setDeleteMember(null);
    },
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi"),
  });

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!branch) return null;

  const branchTeam = (usersQuery.data ?? []).filter((u) => u.branchId === branch.id);
  const branchUrl =
    typeof window !== "undefined" ? `${window.location.origin}/${slug}/${branch.slug}` : `/${slug}/${branch.slug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(branchUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Xavfsiz bo'lmagan manbada clipboard yopiq — havola ko'rinib turibdi,
      // foydalanuvchi qo'lda nusxalay oladi.
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/${slug}/branches`}
          className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
          Filiallar
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <BuildingIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
                {branch.name}
              </h1>
              <p className="text-[13px] text-[var(--color-text-muted)]">/{branch.slug}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditBranchOpen(true)}>
            <PencilIcon className="h-4 w-4" />
            Tahrirlash
          </Button>
        </div>
      </div>

      {/* Filial havolasi */}
      <Card className="overflow-hidden">
        <div className="hairline border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
            Filialning shaxsiy havolasi
          </h2>
          <p className="text-[12.5px] text-[var(--color-text-muted)]">
            Jamoa shu havola orqali kirib, faqat shu filial ma&apos;lumotlarini ko&apos;radi
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1 rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5">
            <a
              href={branchUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all text-[14px] font-medium text-[var(--color-primary)] hover:underline"
            >
              {branchUrl}
            </a>
          </div>
          <Button type="button" variant={copied ? "secondary" : "outline"} size="sm" onClick={copyLink}>
            {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            {copied ? "Nusxalandi" : "Nusxalash"}
          </Button>
        </div>
      </Card>

      {/* Filial ma'lumotlari — ichki guruhlangan ro'yxat */}
      <Card className="overflow-hidden">
        <div className="hairline border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
            Filial ma&apos;lumotlari
          </h2>
        </div>
        <dl className="divide-y divide-[var(--color-separator)]">
          <InfoRow label="Manzil" value={branch.address || "Ko'rsatilmagan"} muted={!branch.address} />
          <InfoRow label="Vaqt zonasi" value={branch.timezone} />
          <InfoRow label="Valyuta" value={branch.currency} />
          <InfoRow label="Yaratilgan sana" value={formatDate(branch.createdAt)} numeric />
        </dl>
      </Card>

      {/* Filial jamoasi */}
      {currentUser?.role === "NETWORK_ADMIN" && (
        <Card className="overflow-hidden">
          <div className="hairline flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
                Filial jamoasi
              </h2>
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                {branchTeam.length > 0 ? `${branchTeam.length} ta hisob` : "Hali hech kim tayinlanmagan"}
              </p>
            </div>
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              Xodim tayinlash
            </Button>
          </div>

          {usersQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : usersQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={(usersQuery.error as Error).message} />
            </div>
          ) : branchTeam.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState
                title="Jamoa hali yig'ilmagan"
                description="Filial admini yoki moliyachi tayinlang — ular shu filialning kundalik ishini yuritadi."
                icon={<TeacherIcon className="h-[26px] w-[26px]" />}
                action={
                  <Button size="sm" onClick={() => setAssignOpen(true)}>
                    <PlusIcon className="h-4 w-4" />
                    Xodim tayinlash
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-separator)]">
              {branchTeam.map((member) => {
                const manageable = canManageUser(currentUser, member);
                const isSelf = currentUser?.id === member.id;
                return (
                  <li
                    key={member.id}
                    className={clsx(
                      "flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-[var(--color-surface-hover)] sm:px-6",
                      !member.isActive && "opacity-60",
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[12px] font-semibold text-[var(--color-text-muted)] ring-1 ring-inset ring-[rgba(16,24,40,0.06)]">
                      {initials(member.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[14px] font-medium text-[var(--color-text)]">{member.fullName}</p>
                        {isSelf && <Badge tone="neutral">Siz</Badge>}
                        {!member.isActive && <Badge tone="danger">Bloklangan</Badge>}
                      </div>
                      <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">{member.email}</p>
                    </div>

                    <span
                      className={clsx(
                        "hidden shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold sm:inline-flex",
                        ROLE_TONE[member.role],
                      )}
                    >
                      {ROLE_LABEL[member.role]}
                    </span>

                    {manageable && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label="Tahrirlash"
                          title="Tahrirlash"
                          onClick={() => setEditMember(member)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label={member.isActive ? "Bloklash" : "Blokdan chiqarish"}
                          title={member.isActive ? "Bloklash" : "Blokdan chiqarish"}
                          onClick={() => {
                            setActionError(null);
                            setBlockMember(member);
                          }}
                        >
                          {member.isActive ? <LockIcon className="h-4 w-4" /> : <UnlockIcon className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          aria-label="O'chirish"
                          title="O'chirish"
                          className="hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                          onClick={() => {
                            setActionError(null);
                            setDeleteMember(member);
                          }}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      <EditBranchModal open={editBranchOpen} onClose={() => setEditBranchOpen(false)} slug={slug} branch={branch} />
      {currentUser && (
        <>
          <CreateTenantUserModal
            open={assignOpen}
            onClose={() => setAssignOpen(false)}
            slug={slug}
            currentUser={currentUser}
            branches={[branch]}
          />
          <EditTenantUserModal
            open={!!editMember}
            onClose={() => setEditMember(null)}
            slug={slug}
            currentUser={currentUser}
            user={editMember}
          />
        </>
      )}

      <ConfirmDialog
        open={!!blockMember}
        onClose={() => setBlockMember(null)}
        title={blockMember?.isActive ? "Hisobni bloklash" : "Blokdan chiqarish"}
        confirmLabel={blockMember?.isActive ? "Bloklash" : "Blokdan chiqarish"}
        tone={blockMember?.isActive ? "danger" : "default"}
        loading={statusMutation.isPending}
        error={actionError}
        description={
          blockMember?.isActive ? (
            <>
              <b className="text-[var(--color-text)]">{blockMember?.fullName}</b> tizimga kira olmaydi va ochiq
              seanslari darhol yopiladi. Ma&apos;lumotlari saqlanib qoladi — istalgan vaqtda blokdan chiqarasiz.
            </>
          ) : (
            <>
              <b className="text-[var(--color-text)]">{blockMember?.fullName}</b> yana tizimga kira oladi.
            </>
          )
        }
        onConfirm={() =>
          blockMember && statusMutation.mutate({ id: blockMember.id, isActive: !blockMember.isActive })
        }
      />

      <ConfirmDialog
        open={!!deleteMember}
        onClose={() => setDeleteMember(null)}
        title="Loginni o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={actionError}
        description={
          <>
            <b className="text-[var(--color-text)]">{deleteMember?.fullName}</b> hisobi butunlay o&apos;chiriladi va
            qaytarilmaydi.
            {deleteMember?.role === "TEACHER" && (
              <>
                {" "}
                Xodim kartochkasi va guruh biriktiruvi saqlanib qoladi — u faqat kabinetsiz qoladi.
              </>
            )}{" "}
            Vaqtincha to&apos;xtatish kerak bo&apos;lsa, o&apos;chirish o&apos;rniga bloklang.
          </>
        }
        onConfirm={() => deleteMember && deleteMutation.mutate(deleteMember.id)}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  muted,
  numeric,
}: {
  label: string;
  value: string;
  muted?: boolean;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
      <dt className="text-[13px] text-[var(--color-text-muted)]">{label}</dt>
      <dd
        className={clsx(
          "text-[14px] font-medium",
          numeric && "tabular-nums",
          muted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
