"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Employee, Group } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { initials } from "@/components/ui/avatar";

export function ManageTeachersModal({
  open,
  onClose,
  slug,
  group,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  group: Group;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, group.branchId],
    queryFn: () => api.get<Employee[]>(`/app/employees?branchId=${group.branchId}`),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: ({ employee, assign }: { employee: Employee; assign: boolean }) => {
      const currentIds = (employee.teachingGroups ?? []).map((link) => link.groupId);
      const nextIds = assign ? [...currentIds, group.id] : currentIds.filter((id) => id !== group.id);
      return api.patch<Employee>(`/app/employees/${employee.id}/groups`, { groupIds: nextIds });
    },
    onMutate: ({ employee }) => setPendingId(employee.id),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["employees", slug, group.branchId] });
      queryClient.invalidateQueries({ queryKey: ["group-overview", slug, group.id] });
      queryClient.invalidateQueries({ queryKey: ["groups", slug] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi"),
    onSettled: () => setPendingId(null),
  });

  const employees = employeesQuery.data ?? [];

  return (
    <Modal open={open} onClose={onClose} title={`Tarbiyachilar — ${group.name}`} widthClassName="max-w-lg">
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">{error}</div>
        )}

        {employeesQuery.isLoading ? (
          <LoadingState rows={4} />
        ) : employeesQuery.isError ? (
          <ErrorState message={(employeesQuery.error as Error).message} />
        ) : employees.length === 0 ? (
          <EmptyState title="Bu filialda xodim yo'q" />
        ) : (
          <ul className="divide-y divide-[var(--color-separator)] rounded-[var(--radius-md)] border border-[var(--color-separator)]">
            {employees.map((employee) => {
              const assigned = (employee.teachingGroups ?? []).some((link) => link.groupId === group.id);
              // Nofaol xodim yangidan biriktirilmasin — lekin avval
              // biriktirilgan bo'lsa (keyin nofaol bo'lib qolgan bo'lsa ham)
              // olib tashlash imkoni qolishi kerak.
              const canAssign = employee.isActive || assigned;
              return (
                <li key={employee.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[12px] font-semibold text-[var(--color-primary)]">
                    {initials(employee.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[var(--color-text)]">
                      {employee.fullName}
                      {!employee.isActive && (
                        <span className="ml-1.5 text-[12px] font-normal text-[var(--color-text-muted)]">(nofaol)</span>
                      )}
                    </p>
                    <p className="text-[12.5px] text-[var(--color-text-muted)]">{employee.position}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={assigned ? "danger" : "outline"}
                    disabled={!canAssign}
                    loading={pendingId === employee.id && mutation.isPending}
                    onClick={() => mutation.mutate({ employee, assign: !assigned })}
                  >
                    {assigned ? "Olib tashlash" : "Biriktirish"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Yopish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
