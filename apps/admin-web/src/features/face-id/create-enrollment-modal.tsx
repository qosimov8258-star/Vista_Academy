"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError, getPaginated } from "@/lib/api";
import type { Child, Employee, FaceIdDevice, FaceEnrollment, FacePersonType } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SelectMenu } from "@/components/ui/select-menu";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";

/** Xodim yoki bolani tanlab, tanlangan qurilmada yuzini ro'yxatga qo'shish. */
export function CreateEnrollmentModal({
  open,
  onClose,
  slug,
  forcedBranchId,
  devices,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  forcedBranchId: string | null;
  devices: FaceIdDevice[];
}) {
  const queryClient = useQueryClient();
  const [deviceId, setDeviceId] = useState("");
  const [personType, setPersonType] = useState<FacePersonType>("EMPLOYEE");
  const [personId, setPersonId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [personError, setPersonError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDeviceId(devices[0]?.id ?? "");
    setPersonType("EMPLOYEE");
    setPersonId(null);
    setSearch("");
    setNotes("");
    setServerError(null);
    setPersonError(null);
    setDeviceError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat oyna ochilganda boshlang'ich holatga qaytariladi
  }, [open]);

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, forcedBranchId],
    queryFn: () => api.get<Employee[]>(`/app/employees${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
    enabled: open && personType === "EMPLOYEE",
  });

  const childrenQuery = useQuery({
    queryKey: ["face-id-children-picker", slug, forcedBranchId, search],
    queryFn: () =>
      getPaginated<Child>(
        `/app/children?page=1&limit=50${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}&search=${encodeURIComponent(search)}`,
      ),
    enabled: open && personType === "CHILD",
  });

  const filteredEmployees = useMemo(() => {
    const list = employeesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter((e) => e.fullName.toLowerCase().includes(q)) : list;
  }, [employeesQuery.data, search]);

  const children = childrenQuery.data?.data ?? [];
  const people = personType === "EMPLOYEE" ? filteredEmployees : children;
  const peopleLoading = personType === "EMPLOYEE" ? employeesQuery.isLoading : childrenQuery.isLoading;

  const mutation = useMutation({
    mutationFn: () =>
      api.post<FaceEnrollment>("/app/face-id/enrollments", {
        deviceId,
        personType,
        employeeId: personType === "EMPLOYEE" ? (personId ?? undefined) : undefined,
        childId: personType === "CHILD" ? (personId ?? undefined) : undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["face-id-enrollments", slug] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi"),
  });

  const handleSubmit = () => {
    const missingDevice = !deviceId;
    const missingPerson = !personId;
    setDeviceError(missingDevice ? "Qurilmani tanlang" : null);
    setPersonError(missingPerson ? (personType === "EMPLOYEE" ? "Xodimni tanlang" : "Bolani tanlang") : null);
    if (missingDevice || missingPerson) return;
    setServerError(null);
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Yuzni ro'yxatga qo'shish">
      <div className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <SelectMenu
          label="Qurilma"
          options={devices.map((d) => ({ value: d.id, label: d.name }))}
          value={deviceId}
          onChange={setDeviceId}
          error={deviceError ?? undefined}
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Kim uchun</span>
          <div className="flex gap-2">
            {(
              [
                ["EMPLOYEE", "Xodim"],
                ["CHILD", "Bola"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setPersonType(value);
                  setPersonId(null);
                  setSearch("");
                  setPersonError(null);
                }}
                aria-pressed={personType === value}
                className={clsx(
                  "cursor-pointer rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors",
                  personType === value
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPersonId(null);
            }}
            placeholder={personType === "EMPLOYEE" ? "Xodim ismi bo'yicha qidirish" : "Bola ismi bo'yicha qidirish"}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60 outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]"
          />
          <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border-hair)] p-1.5">
            {peopleLoading ? (
              <p className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">Yuklanmoqda...</p>
            ) : people.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-[var(--color-text-muted)]">Hech kim topilmadi</p>
            ) : (
              people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    setPersonId(person.id);
                    setPersonError(null);
                  }}
                  className={clsx(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-[14px] transition-colors hover:bg-[var(--color-surface-hover)]",
                    personId === person.id && "bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]",
                  )}
                >
                  {personType === "EMPLOYEE" ? (
                    <EmployeePhoto employee={person as Employee} size={32} fallback={initials(person.fullName)} />
                  ) : (
                    <ChildPhoto child={person as Child} size={32} fallback={initials(person.fullName)} />
                  )}
                  <span className="truncate">{person.fullName}</span>
                </button>
              ))
            )}
          </div>
          {personError && <span className="mt-1.5 block text-[13px] text-[var(--color-danger)]">{personError}</span>}
        </div>

        <Textarea label="Izoh" rows={2} placeholder="Ixtiyoriy" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="button" loading={mutation.isPending} onClick={handleSubmit}>
            Qo&apos;shish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
