"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Employee, Group } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FieldRow, FormSection, IosSwitch, TextInput } from "@/components/ios/form";
import { Row } from "@/components/ios/group";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { isCabinetlessPosition, isGrouplessPosition, isSubjectTeacherPosition, normalizePosition } from "@/lib/employee-position";
import { CatalogPickerSheet, CheckRow, PhotoPickerHero, PickerRow, phoneErrorText } from "@/features/employees/employee-form-parts";
import { useTr } from "@/i18n/tr";

/** Kabinet roli lavozimdan kelib chiqadigan xodimlar (filial admini, moliyachi emas) */
const POSITION_ROLES = ["TEACHER", "CHEF", "MANAGER"];

/** Surat: o'zgarmagan / yangi tanlangan (data URL) / olib tashlanadi */
type PhotoChange = { kind: "keep" } | { kind: "new"; image: string } | { kind: "remove" };

/**
 * Xodimni tahrirlash — iOS varag'i (SaaS ERP'dagi o'qituvchi formasi
 * tartibida): tepada surat, keyin ism, ish (lavozim, fan, telefon),
 * kabineti bo'lsa guruh, oxirida holat. Login/parol bu yerda emas —
 * ular xodim varag'ining «Kabinet» bo'limida.
 */
export function EditEmployeeSheet({
  open,
  onClose,
  slug,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  employee: Employee;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [subject, setSubject] = useState("");
  const [groupId, setGroupId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [photo, setPhoto] = useState<PhotoChange>({ kind: "keep" });
  const [picker, setPicker] = useState<"position" | "subject" | null>(null);
  const [tried, setTried] = useState(false);

  // Har ochilishda xodimning hozirgi ma'lumotidan boshlanadi
  useEffect(() => {
    if (!open) return;
    setLastName(employee.lastName);
    setFirstName(employee.firstName);
    setPhone(employee.phone ?? "");
    setPosition(employee.position);
    setSubject(employee.subjects[0] ?? "");
    setGroupId(employee.teachingGroups?.[0]?.groupId ?? "");
    setIsActive(employee.isActive);
    setPhoto({ kind: "keep" });
    setPicker(null);
    setTried(false);
  }, [open, employee]);

  const subjectTeacher = isSubjectTeacherPosition(position);
  const hasCabinet = !!employee.tenantUser;
  const showGroups = hasCabinet && POSITION_ROLES.includes(employee.tenantUser!.role) && !isGrouplessPosition(position);
  // Kabineti bor xodimni kabinetsiz lavozimga o'tkazib bo'lmaydi (server ham rad etadi)
  const positionBlocked = hasCabinet && isCabinetlessPosition(position) && normalizePosition(position) !== normalizePosition(employee.position);

  const groupsQuery = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open && showGroups,
  });

  // Faqat o'zgartirilgan raqam tekshiriladi — eski yozuvdagi g'ayrioddiy raqam boshqa maydonni saqlashga xalaqit bermasin
  const phoneChanged = phone.trim() !== (employee.phone ?? "");
  const phoneError = phone.trim() && phoneChanged ? phoneErrorText(phone) : undefined;
  const errors = {
    lastName: lastName.trim().length < 2 ? "Familiya kamida 2 belgi" : undefined,
    firstName: firstName.trim().length < 2 ? "Ism kamida 2 belgi" : undefined,
    phone: phoneError,
    position: positionBlocked ? "Kabineti bor xodimni kabinetsiz lavozimga o'tkazib bo'lmaydi" : undefined,
    subject: subjectTeacher && !subject ? "Fanni tanlang" : undefined,
    group: showGroups && !groupId ? "Guruhni tanlang" : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);

  const originalGroupId = employee.teachingGroups?.[0]?.groupId ?? "";
  const dirty =
    lastName.trim() !== employee.lastName ||
    firstName.trim() !== employee.firstName ||
    phoneChanged ||
    normalizePosition(position) !== normalizePosition(employee.position) ||
    (subjectTeacher && subject !== (employee.subjects[0] ?? "")) ||
    (showGroups && groupId !== originalGroupId) ||
    isActive !== employee.isActive ||
    photo.kind !== "keep";

  const save = useMutation({
    mutationFn: async () => {
      await api.patch<Employee>(`/app/employees/${employee.id}`, {
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        phone: phoneChanged ? phone.trim() : undefined,
        position: position.trim(),
        subjects: subjectTeacher ? [subject] : undefined,
        isActive,
        // Guruh faqat almashtirilganda yuboriladi (eski yozuvlarda bir nechta guruh bo'lishi mumkin)
        groupIds: showGroups && groupId !== originalGroupId ? [groupId] : undefined,
      });
      if (photo.kind === "new") await api.put(`/app/employees/${employee.id}/avatar`, { image: photo.image });
      if (photo.kind === "remove") await api.delete(`/app/employees/${employee.id}/avatar`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      queryClient.invalidateQueries({ queryKey: ["groups", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      onClose();
    },
  });
  const { reset } = save;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const submit = () => {
    setTried(true);
    if (!valid || !dirty || save.isPending) return;
    save.mutate();
  };

  const hasSavedPhoto = !!employee.avatarUpdatedAt;
  const showsPhoto = photo.kind === "new" || (photo.kind === "keep" && hasSavedPhoto);
  const close = () => !save.isPending && onClose();
  const show = (key: keyof typeof errors) => (tried ? errors[key] : undefined);

  return (
    <>
      <IosSheet
        open={open}
        onClose={close}
        title={tr("Xodimni tahrirlash")}
        footer={
          <SheetPrimaryButton onClick={submit} loading={save.isPending} dim={!valid || !dirty}>
            {tr("Saqlash")}
          </SheetPrimaryButton>
        }
      >
        <PhotoPickerHero
          hasPhoto={showsPhoto}
          preview={
            photo.kind === "new" ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL
              <img src={photo.image} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <EmployeePhoto employee={employee} size={88} fallback={initials(employee.fullName)} />
            )
          }
          initialsText={initials(`${lastName} ${firstName}`)}
          onPick={(image) => setPhoto({ kind: "new", image })}
          onRemove={() => setPhoto(hasSavedPhoto ? { kind: "remove" } : { kind: "keep" })}
          hint="Faqat xodimning o'zi, yuzi aniq ko'rinsin — Face ID shu surat bilan taniydi"
        />

        <FormSection>
          <FieldRow label={tr("Familiya")} htmlFor="emp-last" error={show("lastName")}>
            <TextInput id="emp-last" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} placeholder={tr("Yusupova")} autoComplete="off" />
          </FieldRow>
          <FieldRow label={tr("Ism")} htmlFor="emp-first" error={show("firstName")}>
            <TextInput id="emp-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} placeholder={tr("Dilnoza")} autoComplete="off" />
          </FieldRow>
        </FormSection>

        <FormSection title={tr("Ish")}>
          <PickerRow label={tr("Lavozim")} value={tr(position)} placeholder={tr("Tanlang")} onClick={() => setPicker("position")} error={show("position")} />
          {subjectTeacher && <PickerRow label={tr("Fan")} value={subject ? tr(subject) : ""} placeholder={tr("Tanlang")} onClick={() => setPicker("subject")} error={show("subject")} />}
          <FieldRow label={tr("Telefon")} htmlFor="emp-phone" error={show("phone")}>
            <TextInput
              id="emp-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={17}
              placeholder="+998 90 123 45 67"
              autoComplete="off"
              className="tabular-nums"
            />
          </FieldRow>
        </FormSection>

        {showGroups && (
          <FormSection
            title={tr("Guruh")}
            footer={show("group") ? <span className="text-[#ff3b30]">{tr(errors.group!)}</span> : tr("Xodim faqat shu guruhni ko'radi va davomatini yuritadi.")}
          >
            {groupsQuery.isLoading ? (
              <Row title={<span className="text-[#8e8e93]">{tr("Guruhlar yuklanmoqda...")}</span>} />
            ) : (groupsQuery.data ?? []).length === 0 ? (
              <Row title={<span className="text-[#8e8e93]">{tr("Avval guruh oching.")}</span>} />
            ) : (
              (groupsQuery.data ?? []).map((g) => (
                <CheckRow key={g.id} label={tr(g.name)} checked={groupId === g.id} onClick={() => setGroupId(g.id)} />
              ))
            )}
          </FormSection>
        )}

        <FormSection
          title={tr("Holat")}
          footer={
            isActive
              ? tr("Nofaol qilinsa xodim kabinetga kira olmaydi va Face ID terminalidan olib tashlanadi. Tarixi saqlanib qoladi.")
              : tr("Xodim nofaol: kabinetga kira olmaydi, Face ID uni tanimaydi. Davomat va oylik tarixi saqlangan.")
          }
        >
          <div className="flex min-h-[52px] items-center gap-3 px-4">
            <span className="flex-1 text-[15px] text-[var(--color-text)]">{tr("Faol")}</span>
            <IosSwitch checked={isActive} onChange={setIsActive} label={tr("Faol")} />
          </div>
        </FormSection>

        {save.error && (
          <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
            {save.error instanceof ApiError ? tr(save.error.message) : tr("Saqlab bo'lmadi")}
          </p>
        )}
      </IosSheet>

      {/* Lavozim / fan tanlash — ichki varaq, tanlangani ✓ bilan, yangisini ham qo'shsa bo'ladi */}
      <CatalogPickerSheet
        open={open && picker !== null}
        onClose={() => setPicker(null)}
        kind={picker ?? "position"}
        slug={slug}
        selected={picker === "subject" ? subject : position}
        onSelect={(name) => (picker === "subject" ? setSubject(name) : setPosition(name))}
      />
    </>
  );
}
