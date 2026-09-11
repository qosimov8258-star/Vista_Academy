"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { CreateEmployeeResult, Employee, EmployeeCredentials, Group } from "@/lib/types";
import { deleteEmployeeWithConfirmation, revealEmployeePassword, webauthnErrorMessage } from "@/lib/webauthn";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CredentialRow } from "@/components/ui/credential-row";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { PhoneIcon, EyeIcon, EyeOffIcon, CheckIcon, TrashIcon } from "@/components/ui/icons";
import { formatPositionLabel, isSubjectTeacherPosition } from "@/lib/employee-position";
import { EmployeeTopics } from "@/features/employees/employee-topics";

/**
 * Xodim ustiga bosilganda ochiladi: telefon, login va kabinet paroli shu yerda.
 * Parol qaytarib olinadigan (shifrlangan) holda saqlanadi, lekin ko'rsatishdan
 * oldin har safar admin qurilmasi WebAuthn (Face ID/Windows Hello/PIN) bilan
 * tasdiqlanishi kerak — shundan keyingina ochiladi (`revealEmployeePassword`).
 */
export function EmployeeDetailModal({
  open,
  onClose,
  slug,
  employee,
  canWrite,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  employee: Employee | null;
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();

  const [visiblePassword, setVisiblePassword] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  const [accountOpen, setAccountOpen] = useState(false);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<EmployeeCredentials | null>(null);

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setVisiblePassword(null);
      setRevealing(false);
      setRevealError(null);
      setAccountOpen(false);
      setGroupIds([]);
      setAccountError(null);
      setCreatedCredentials(null);
      setDeleteConfirming(false);
      setDeleting(false);
      setDeleteError(null);
    }
  }, [open]);

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open && accountOpen,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.post<{ password: string }>(`/app/employees/${employee!.id}/password/regenerate`),
    onSuccess: (data) => {
      setVisiblePassword(data.password);
      setRevealError(null);
    },
    onError: (err) => {
      setRevealError(err instanceof ApiError ? err.message : "Parolni yangilab bo'lmadi");
    },
  });

  const accountMutation = useMutation({
    mutationFn: () => api.post<CreateEmployeeResult>(`/app/employees/${employee!.id}/account`, { groupIds }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      setAccountOpen(false);
      setGroupIds([]);
      setAccountError(null);
      if (result.credentials) {
        setCreatedCredentials(result.credentials);
      }
    },
    onError: (err) => {
      setAccountError(err instanceof ApiError ? err.message : "Kabinet ochib bo'lmadi");
    },
  });

  if (!employee) return null;

  const toggleGroup = (id: string) => {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  };

  const handleShowPassword = async () => {
    if (visiblePassword) {
      setVisiblePassword(null);
      return;
    }
    setRevealing(true);
    setRevealError(null);
    try {
      const { password } = await revealEmployeePassword(employee.id);
      setVisiblePassword(password);
    } catch (err) {
      setRevealError(webauthnErrorMessage(err));
    } finally {
      setRevealing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEmployeeWithConfirmation(employee.id);
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      onClose();
    } catch (err) {
      setDeleteError(webauthnErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (createdCredentials) {
    return (
      <Modal open={open} onClose={onClose} title="Kabinet ochildi" widthClassName="max-w-md">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
              <CheckIcon className="h-6 w-6" />
            </span>
            <p className="text-sm text-[var(--color-text-muted)]">
              Login va parolni xodimga bering — parol qayta ko&apos;rsatilmaydi.
            </p>
          </div>
          <CredentialRow label="Login" value={createdCredentials.login} />
          <CredentialRow label="Parol" value={createdCredentials.password} />
          <div className="flex justify-end pt-1">
            <Button type="button" onClick={onClose}>
              Yopish
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Xodim" widthClassName="max-w-md">
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-2">
          <EmployeePhoto
            employee={employee}
            size={72}
            shape="circle"
            fallback={initials(employee.fullName)}
            className="text-[22px]"
          />
          <div className="text-center">
            <p className="text-[16px] font-semibold text-[var(--color-text)]">{employee.fullName}</p>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {formatPositionLabel(employee.position, employee.subjects)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={employee.isActive ? "success" : "neutral"}>{employee.isActive ? "Faol" : "Nofaol"}</Badge>
            {canWrite && !deleteConfirming && (
              <button
                type="button"
                onClick={() => setDeleteConfirming(true)}
                className="flex cursor-pointer items-center gap-1 rounded-full bg-[var(--color-danger-bg)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-danger)] hover:brightness-[0.96]"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                O&apos;chirish
              </button>
            )}
          </div>
        </div>

        {deleteConfirming && (
          <div className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-danger)]/25 bg-[var(--color-danger-bg)] p-3.5">
            <p className="text-[13px] text-[var(--color-danger)]">
              &quot;{employee.fullName}&quot;ni butunlay o&apos;chirmoqchimisiz? Uning davomat va oylik tarixi ham
              qaytarib bo&apos;lmas tarzda o&apos;chadi.
            </p>
            {deleteError && <p className="text-xs text-[var(--color-danger)]">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deleting}
                onClick={() => {
                  setDeleteConfirming(false);
                  setDeleteError(null);
                }}
              >
                Bekor qilish
              </Button>
              <Button type="button" variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
                Ha, o&apos;chirish
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-3">
          <PhoneIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          <span className="text-sm text-[var(--color-text)]">{employee.phone ?? "Telefon raqami kiritilmagan"}</span>
        </div>

        {employee.teachingGroups?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {employee.teachingGroups.map((link) => (
              <Badge key={link.groupId} tone="primary">
                {link.group?.name ?? "Guruh"}
              </Badge>
            ))}
          </div>
        ) : null}

        {employee.tenantUser ? (
          <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--color-text)]">Login</p>
                <p className="truncate text-sm text-[var(--color-text-muted)]">{employee.tenantUser.login}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--color-text)]">Parol</p>
                <p className="truncate font-mono text-sm text-[var(--color-text-muted)]">
                  {visiblePassword ?? "••••••••••"}
                </p>
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={handleShowPassword}
                  disabled={revealing}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-border)] disabled:cursor-wait disabled:opacity-60"
                  aria-label={visiblePassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                >
                  {revealing ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : visiblePassword ? (
                    <EyeOffIcon className="h-3.5 w-3.5" />
                  ) : (
                    <EyeIcon className="h-3.5 w-3.5" />
                  )}
                  {revealing ? "Tasdiqlanmoqda..." : visiblePassword ? "Yashirish" : "Ko'rsatish"}
                </button>
              )}
            </div>
            {revealError && <p className="text-xs text-[var(--color-danger)]">{revealError}</p>}
            {canWrite && (
              <button
                type="button"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
                className="cursor-pointer text-[12.5px] font-medium text-[var(--color-primary)] hover:underline disabled:opacity-60"
              >
                {regenerateMutation.isPending ? "Yaratilmoqda..." : "Yangi parol generatsiya qilish"}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--color-text-muted)]">Kabinet ochilmagan</p>
              {canWrite && !accountOpen && (
                <Button type="button" variant="outline" size="sm" onClick={() => setAccountOpen(true)}>
                  Kabinet ochish
                </Button>
              )}
            </div>

            {accountOpen && (
              <div className="space-y-3 border-t border-[var(--color-border)] pt-3">
                {accountError && (
                  <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
                    {accountError}
                  </div>
                )}
                <p className="text-xs text-[var(--color-text-muted)]">
                  Login va parol avtomatik generatsiya qilinadi va bir marta ko&apos;rsatiladi.
                </p>
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Guruhlari</span>
                  {!groups ? (
                    <p className="text-xs text-[var(--color-text-muted)]">Guruhlar yuklanmoqda...</p>
                  ) : groups.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">Avval guruh oching.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {groups.map((group) => {
                        const selected = groupIds.includes(group.id);
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => toggleGroup(group.id)}
                            aria-pressed={selected}
                            className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                              selected
                                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                            }`}
                          >
                            {group.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAccountOpen(false)}>
                    Bekor qilish
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    loading={accountMutation.isPending}
                    onClick={() => {
                      if (groupIds.length === 0) {
                        setAccountError("Kamida bitta guruh tanlang");
                        return;
                      }
                      setAccountError(null);
                      accountMutation.mutate();
                    }}
                  >
                    Ochish
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {isSubjectTeacherPosition(employee.position) && <EmployeeTopics slug={slug} employeeId={employee.id} />}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Yopish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
