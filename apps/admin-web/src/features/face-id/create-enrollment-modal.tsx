"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, getPaginated } from "@/lib/api";
import type { Child, Employee, FaceIdDevice, FaceEnrollment, FacePersonType } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FieldRow, FormSection, Segmented, TextArea } from "@/components/ios/form";
import { CheckRow } from "@/components/ios/check-row";
import { SearchPill } from "@/components/ios/filters";
import { SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, SECTION_TITLE } from "@/components/ios/tokens";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { TintNote } from "./shared";
import { useTr } from "@/i18n/tr";

/** Xodim yoki bolani tanlab, tanlangan qurilmada yuzini ro'yxatga qo'shish (iOS varag'i). */
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
  const tr = useTr();
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
    onError: (err) => setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const handleSubmit = () => {
    const missingDevice = !deviceId;
    const missingPerson = !personId;
    setDeviceError(missingDevice ? tr("Qurilmani tanlang") : null);
    setPersonError(missingPerson ? (personType === "EMPLOYEE" ? tr("Xodimni tanlang") : tr("Bolani tanlang")) : null);
    if (missingDevice || missingPerson) return;
    setServerError(null);
    mutation.mutate();
  };

  const switchType = (value: FacePersonType) => {
    setPersonType(value);
    setPersonId(null);
    setSearch("");
    setPersonError(null);
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={tr("Yuz qo'shish")}
      footer={
        <SheetPrimaryButton onClick={handleSubmit} loading={mutation.isPending} dim={!deviceId || !personId}>
          {tr("Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      {serverError && <TintNote color={IOS.red}>{tr(serverError)}</TintNote>}

      <FormSection title={tr("Qurilma")} footer={deviceError ? <span className="text-[#ff3b30]">{deviceError}</span> : undefined}>
        <div role="radiogroup" aria-label={tr("Qurilma")}>
          {devices.map((d) => (
            <CheckRow
              key={d.id}
              label={d.name}
              subtitle={d.location ?? d.model}
              checked={deviceId === d.id}
              onClick={() => {
                setDeviceId(d.id);
                setDeviceError(null);
              }}
            />
          ))}
        </div>
      </FormSection>

      <section className="space-y-3">
        <h3 className={SECTION_TITLE}>{tr("Kim uchun")}</h3>
        <Segmented<FacePersonType>
          value={personType}
          onChange={switchType}
          label={tr("Kim uchun")}
          options={[
            { value: "EMPLOYEE", label: tr("Xodim") },
            { value: "CHILD", label: tr("Bola") },
          ]}
        />
        <SearchPill
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPersonId(null);
          }}
          placeholder={personType === "EMPLOYEE" ? tr("Xodim ismi bo'yicha qidirish") : tr("Bola ismi bo'yicha qidirish")}
        />
        {peopleLoading ? (
          <SkeletonRows rows={3} />
        ) : people.length === 0 ? (
          <p className={`${GROUP_BLOCK} px-4 py-4 text-center text-[14px] text-[#8e8e93]`}>{tr("Hech kim topilmadi")}</p>
        ) : (
          <div role="radiogroup" aria-label={tr("Kim uchun")} className={GROUP_BLOCK}>
            {people.map((person) => (
              <CheckRow
                key={person.id}
                label={person.fullName}
                checked={personId === person.id}
                onClick={() => {
                  setPersonId(person.id);
                  setPersonError(null);
                }}
                leading={
                  personType === "EMPLOYEE" ? (
                    <EmployeePhoto employee={person as Employee} size={30} fallback={initials(person.fullName)} />
                  ) : (
                    <ChildPhoto child={person as Child} size={30} fallback={initials(person.fullName)} />
                  )
                }
              />
            ))}
          </div>
        )}
        {personError && <p className="px-4 text-[13px] text-[#ff3b30]">{personError}</p>}
      </section>

      <FormSection>
        <FieldRow label={tr("Izoh")} stacked>
          <TextArea rows={2} placeholder={tr("Ixtiyoriy")} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label={tr("Izoh")} />
        </FieldRow>
      </FormSection>
    </IosSheet>
  );
}
