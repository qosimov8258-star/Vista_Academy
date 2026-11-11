"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Employee, Group, Position, Subject } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FieldRow, FormSection, IosSwitch, TextInput } from "@/components/ios/form";
import { Row } from "@/components/ios/group";
import { CameraIcon, CheckIcon } from "@/components/ios/icons";
import { Spinner } from "@/components/ios/spinner";
import { ROW_SEPARATOR } from "@/components/ios/tokens";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { prepareChildPhoto } from "@/lib/child-photo";
import { validateUzbekPhone } from "@/lib/phone";
import { isCabinetlessPosition, isGrouplessPosition, isSubjectTeacherPosition, normalizePosition } from "@/lib/employee-position";
import { useTr } from "@/i18n/tr";

/** Kabinet roli lavozimdan kelib chiqadigan xodimlar (filial admini, moliyachi emas) */
const POSITION_ROLES = ["TEACHER", "CHEF", "MANAGER"];

const PHONE_ERRORS = {
  prefix: "Telefon raqami +998 bilan boshlanishi kerak",
  length: "Telefon raqami 9 xonali bo'lishi kerak (+998 dan keyin)",
  code: "Bunday operator kodi mavjud emas (masalan: 90, 91, 93, 94, 95, 97, 98, 99)",
} as const;

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
  const fileRef = useRef<HTMLInputElement>(null);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("");
  const [subject, setSubject] = useState("");
  const [groupId, setGroupId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [photo, setPhoto] = useState<PhotoChange>({ kind: "keep" });
  const [photoChecking, setPhotoChecking] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
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
    setPhotoError(null);
    setPicker(null);
    setTried(false);
  }, [open, employee]);

  const subjectTeacher = isSubjectTeacherPosition(position);
  const hasCabinet = !!employee.tenantUser;
  const showGroups = hasCabinet && POSITION_ROLES.includes(employee.tenantUser!.role) && !isGrouplessPosition(position);
  // Kabineti bor xodimni kabinetsiz lavozimga o'tkazib bo'lmaydi (server ham rad etadi)
  const positionBlocked = hasCabinet && isCabinetlessPosition(position) && normalizePosition(position) !== normalizePosition(employee.position);

  const positionsQuery = useQuery({
    queryKey: ["positions", slug],
    queryFn: () => api.get<Position[]>("/app/positions"),
    enabled: open,
  });
  const subjectsQuery = useQuery({
    queryKey: ["subjects", slug],
    queryFn: () => api.get<Subject[]>("/app/subjects"),
    enabled: open && subjectTeacher,
  });
  const groupsQuery = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open && showGroups,
  });

  // Faqat o'zgartirilgan raqam tekshiriladi — eski yozuvdagi g'ayrioddiy raqam boshqa maydonni saqlashga xalaqit bermasin
  const phoneChanged = phone.trim() !== (employee.phone ?? "");
  const phoneError = phone.trim() && phoneChanged ? validateUzbekPhone(phone) : null;
  const errors = {
    lastName: lastName.trim().length < 2 ? "Familiya kamida 2 belgi" : undefined,
    firstName: firstName.trim().length < 2 ? "Ism kamida 2 belgi" : undefined,
    phone: phoneError ? PHONE_ERRORS[phoneError] : undefined,
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

  const pickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setPhotoChecking(true);
    try {
      const result = await prepareChildPhoto(file);
      if (result.ok) setPhoto({ kind: "new", image: result.image });
      else setPhotoError(result.reason.replace("Bolaning", "Xodimning").replace("bolaning", "xodimning"));
    } finally {
      setPhotoChecking(false);
    }
  };

  const hasSavedPhoto = !!employee.avatarUpdatedAt;
  const showsPhoto = photo.kind === "new" || (photo.kind === "keep" && hasSavedPhoto);
  const close = () => !save.isPending && onClose();
  const show = (key: keyof typeof errors) => (tried ? errors[key] : undefined);

  // Lavozimlar katalogi; ro'yxatdan chiqarilgan bo'lsa ham hozirgisi ko'rinsin
  const positionNames = (positionsQuery.data ?? []).map((p) => p.name);
  const positionOptions = positionNames.some((n) => normalizePosition(n) === normalizePosition(position)) || !position ? positionNames : [position, ...positionNames];
  const subjectNames = (subjectsQuery.data ?? []).map((s) => s.name);
  const subjectOptions = !subject || subjectNames.includes(subject) ? subjectNames : [subject, ...subjectNames];

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
        {/* Surat — Kontaktlar ilovasidagidek tepada, markazda */}
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoChecking}
            aria-label={showsPhoto ? tr("Suratni almashtirish") : tr("Surat qo'yish")}
            className="relative h-[88px] w-[88px] rounded-full transition-transform active:scale-[0.97] disabled:cursor-wait"
          >
            {photo.kind === "new" ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL
              <img src={photo.image} alt="" className="h-full w-full rounded-full object-cover" />
            ) : photo.kind === "keep" && hasSavedPhoto ? (
              <EmployeePhoto employee={employee} size={88} fallback={initials(employee.fullName)} />
            ) : (
              <span className="flex h-full w-full items-center justify-center rounded-full bg-[#8e8e93] text-[30px] font-semibold text-white">
                {initials(`${lastName} ${firstName}`) || <CameraIcon className="h-8 w-8" />}
              </span>
            )}
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f2f2f7] bg-[var(--color-primary)] text-white">
              {photoChecking ? <Spinner className="h-3.5 w-3.5 text-white" /> : <CameraIcon className="h-3.5 w-3.5" strokeWidth={2.4} />}
            </span>
          </button>
          <div className="flex items-center gap-4 text-[15px] font-medium">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={photoChecking} className="text-[var(--color-primary)] transition-opacity active:opacity-50">
              {photoChecking ? tr("Tekshirilmoqda…") : showsPhoto ? tr("Almashtirish") : tr("Surat qo'yish")}
            </button>
            {showsPhoto && !photoChecking && (
              <button
                type="button"
                onClick={() => setPhoto(hasSavedPhoto ? { kind: "remove" } : { kind: "keep" })}
                className="text-[#ff3b30] transition-opacity active:opacity-50"
              >
                {tr("Olib tashlash")}
              </button>
            )}
          </div>
          {photoError ? (
            <p role="alert" className="max-w-[320px] text-center text-[12.5px] text-[#ff3b30]">
              {tr(photoError)}
            </p>
          ) : (
            <p className="text-center text-[12.5px] text-[#8e8e93]">{tr("Faqat xodimning o'zi, yuzi aniq ko'rinsin — Face ID shu surat bilan taniydi")}</p>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pickPhoto} />
        </div>

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

      {/* Lavozim / fan tanlash — ichki varaq, tanlangani ✓ bilan, tanlangach o'zi yopiladi */}
      <IosSheet
        open={open && picker !== null}
        onClose={() => setPicker(null)}
        cancelLabel="Orqaga"
        title={picker === "subject" ? tr("Fan") : tr("Lavozim")}
      >
        <FormSection
          footer={
            picker === "subject"
              ? tr("Yangi fan «Yangi xodim» oynasidagi fanlar ro'yxatidan qo'shiladi.")
              : tr("Yangi lavozim «Yangi xodim» oynasidagi lavozimlar ro'yxatidan qo'shiladi.")
          }
        >
          {(picker === "subject" ? subjectsQuery : positionsQuery).isLoading ? (
            <Row title={<span className="text-[#8e8e93]">{tr("Yuklanmoqda...")}</span>} />
          ) : (
            (picker === "subject" ? subjectOptions : positionOptions).map((name) => {
              const checked = picker === "subject" ? name === subject : normalizePosition(name) === normalizePosition(position);
              return (
                <CheckRow
                  key={name}
                  label={tr(name)}
                  checked={checked}
                  onClick={() => {
                    if (picker === "subject") setSubject(name);
                    else setPosition(name);
                    setPicker(null);
                  }}
                />
              );
            })
          )}
        </FormSection>
      </IosSheet>
    </>
  );
}

/** Forma qatori: chapda yorliq, o'ngda tanlangan qiymat va «›» — bosilsa ro'yxat ochiladi */
function PickerRow({ label, value, placeholder, onClick, error }: { label: string; value: string; placeholder: string; onClick: () => void; error?: string }) {
  const tr = useTr();
  return (
    <div className={clsx("group/row relative", error && "bg-[#ff3b30]/[0.06]")}>
      <button type="button" onClick={onClick} className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]">
        <span className="w-[108px] shrink-0 py-3 text-[15px] text-[var(--color-text)]">{label}</span>
        <span className={clsx("min-w-0 flex-1 truncate text-right text-[15px]", value ? "text-[#8e8e93]" : "text-[#c4c4c6]")}>{value || placeholder}</span>
        <svg className="h-4 w-4 shrink-0 text-[#c7c7cc]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {error && (
        <p role="alert" className="-mt-1 px-4 pb-2.5 text-[12.5px] leading-snug text-[#ff3b30]">
          {tr(error)}
        </p>
      )}
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

/** Ro'yxatdan bittasini tanlash qatori — tanlangani o'ngda ✓ */
function CheckRow({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <div className="group/row relative">
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={onClick}
        className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
      >
        <span className="min-w-0 flex-1 truncate py-3 text-[15px] text-[var(--color-text)]">{label}</span>
        {checked && <CheckIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
      </button>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}
