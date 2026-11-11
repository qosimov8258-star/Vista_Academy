"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { CreateEmployeeResult, EmployeeCredentials, Group, Position } from "@/lib/types";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { FieldRow, FormSection, IosSwitch, PasswordInput, TextInput } from "@/components/ios/form";
import { Row } from "@/components/ios/group";
import { CheckIcon } from "@/components/ios/icons";
import { ROW_SEPARATOR } from "@/components/ios/tokens";
import { initials } from "@/components/ui/avatar";
import { PasswordChecklist, getPasswordRules } from "@/components/ui/password-checklist";
import { isCabinetlessPosition, isCookPosition, isGrouplessPosition, isSubjectTeacherPosition } from "@/lib/employee-position";
import { CatalogPickerSheet, CheckRow, CopyRow, PhotoPickerHero, PickerRow, phoneErrorText } from "@/features/employees/employee-form-parts";
import { useTr } from "@/i18n/tr";

/**
 * Yangi xodim — iOS varag'i (tahrirlash varag'i bilan bir xil tartib):
 * tepada surat (majburiy, yuz tekshiriladi), ism, ish (lavozim, fan,
 * telefon), kabinet (ixtiyoriy: login/parol, guruh). Lavozim va fan
 * ichki varaqda tanlanadi yoki o'sha yerda yangisi qo'shiladi.
 * Kabinet ochilsa login va parol bir marta ko'rsatiladi.
 */
export function CreateEmployeeModal({
  open,
  onClose,
  slug,
  initialPosition = null,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  initialPosition?: Position | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();

  const [photo, setPhoto] = useState<string | null>(null);
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("+998 ");
  const [position, setPosition] = useState("");
  const [subject, setSubject] = useState("");
  const [withAccount, setWithAccount] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [groupId, setGroupId] = useState("");
  const [picker, setPicker] = useState<"position" | "subject" | null>(null);
  const [tried, setTried] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<EmployeeCredentials | null>(null);

  // Har ochilishda toza forma
  useEffect(() => {
    if (!open) return;
    setPhoto(null);
    setLastName("");
    setFirstName("");
    setPhone("+998 ");
    setPosition(initialPosition?.name ?? "");
    setSubject("");
    setWithAccount(false);
    setLogin("");
    setPassword("");
    setConfirmPassword("");
    setGroupId("");
    setPicker(null);
    setTried(false);
    setCreatedCredentials(null);
  }, [open, initialPosition]);

  const subjectTeacher = isSubjectTeacherPosition(position);
  // Oshpaz yordamchisi, idish yuvuvchi, kassir — tizimga kirmaydi
  const cabinetless = isCabinetlessPosition(position);
  // Oshpaz, operator, administrator guruhga biriktirilmaydi
  const groupless = isCookPosition(position) || isGrouplessPosition(position);
  const account = withAccount && !cabinetless;
  const needsGroup = account && !groupless;

  const groupsQuery = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open && needsGroup,
  });

  const loginTrim = login.trim();
  const passwordRules = getPasswordRules(password, confirmPassword);
  const errors = {
    photo: !photo ? "Xodim surati talab qilinadi" : undefined,
    lastName: lastName.trim().length < 2 ? "Familiya kamida 2 belgi" : undefined,
    firstName: firstName.trim().length < 2 ? "Ism kamida 2 belgi" : undefined,
    phone: phone.replace(/\D/g, "").length <= 3 ? "Telefon raqami kiritilishi shart" : phoneErrorText(phone),
    position: position.trim().length < 2 ? "Lavozimni tanlang" : undefined,
    subject: subjectTeacher && !subject ? "Fanni tanlang" : undefined,
    login: account && loginTrim && loginTrim.length < 3 ? "Login kamida 3 belgi bo'lishi kerak" : undefined,
    password: account && password && getPasswordRules(password).some((r) => !r.met) ? "Parol talablarga javob bermaydi" : undefined,
    confirm: account && password && password !== confirmPassword ? "Parollar mos kelmadi" : undefined,
    group: needsGroup && !groupId ? "Guruhni tanlang" : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (key: keyof typeof errors) => (tried ? errors[key] : undefined);

  const create = useMutation({
    mutationFn: async () => {
      const result = await api.post<CreateEmployeeResult>("/app/employees", {
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        phone: phone.trim(),
        position: position.trim(),
        subjects: subjectTeacher ? [subject] : undefined,
        account: account
          ? {
              groupIds: needsGroup ? [groupId] : [],
              login: loginTrim || undefined,
              password: password || undefined,
            }
          : undefined,
      });
      // Surat xodim yaratilgandan keyin alohida so'rov bilan yuklanadi; shu so'rov
      // muvaffaqiyatsiz bo'lsa ham xodim yozuvi allaqachon yaratilgan hisoblanadi.
      await api.put(`/app/employees/${result.employee.id}/avatar`, { image: photo }).catch(() => {});
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      queryClient.invalidateQueries({ queryKey: ["groups", slug] });
      queryClient.invalidateQueries({ queryKey: ["positions", slug] });
      // Login/parol shu javobda bir marta keladi — yopishdan oldin ko'rsatiladi
      if (result.credentials) setCreatedCredentials(result.credentials);
      else onClose();
    },
  });
  const { reset } = create;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const submit = () => {
    setTried(true);
    if (!valid || create.isPending) return;
    create.mutate();
  };
  const close = () => !create.isPending && onClose();

  if (createdCredentials) {
    return (
      <IosSheet open={open} onClose={onClose} cancelLabel="Yopish" title={tr("Xodim qo'shildi")} footer={<SheetPrimaryButton onClick={onClose}>{tr("Tayyor")}</SheetPrimaryButton>}>
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#34c759]/[0.14] text-[#34c759]">
            <CheckIcon className="h-7 w-7" strokeWidth={2.6} />
          </span>
          <p className="px-6 text-[13px] text-[#8e8e93]">{tr("Kabinet ochildi. Login va parolni xodimga bering — parol qayta ko'rsatilmaydi.")}</p>
        </div>
        <SheetSection>
          <CopyRow label={tr("Login")} value={createdCredentials.login} />
          <CopyRow label={tr("Parol")} value={createdCredentials.password} />
        </SheetSection>
      </IosSheet>
    );
  }

  return (
    <>
      <IosSheet
        open={open}
        onClose={close}
        title={tr("Yangi xodim")}
        footer={
          <SheetPrimaryButton onClick={submit} loading={create.isPending} dim={!valid}>
            {tr("Qo'shish")}
          </SheetPrimaryButton>
        }
      >
        <PhotoPickerHero
          hasPhoto={!!photo}
          preview={photo ? <img src={photo} alt="" className="h-full w-full rounded-full object-cover" /> : null}
          initialsText={initials(`${lastName} ${firstName}`)}
          onPick={setPhoto}
          onRemove={() => setPhoto(null)}
          hint="Majburiy · faqat xodimning o'zi, yuzi aniq ko'rinsin — Face ID shu surat bilan taniydi"
          error={show("photo")}
        />

        <FormSection>
          <FieldRow label={tr("Familiya")} htmlFor="new-emp-last" error={show("lastName")}>
            <TextInput id="new-emp-last" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} placeholder={tr("Yusupova")} autoComplete="off" />
          </FieldRow>
          <FieldRow label={tr("Ism")} htmlFor="new-emp-first" error={show("firstName")}>
            <TextInput id="new-emp-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} placeholder={tr("Dilnoza")} autoComplete="off" />
          </FieldRow>
        </FormSection>

        <FormSection title={tr("Ish")}>
          <PickerRow label={tr("Lavozim")} value={position ? tr(position) : ""} placeholder={tr("Tanlang")} onClick={() => setPicker("position")} error={show("position")} />
          {subjectTeacher && <PickerRow label={tr("Fan")} value={subject ? tr(subject) : ""} placeholder={tr("Tanlang")} onClick={() => setPicker("subject")} error={show("subject")} />}
          <FieldRow label={tr("Telefon")} htmlFor="new-emp-phone" error={show("phone")}>
            <TextInput
              id="new-emp-phone"
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

        {cabinetless ? (
          <FormSection title={tr("Kabinet")}>
            <Row title={<span className="text-[#8e8e93]">{tr("Bu lavozimdagi xodim tizimga kirmaydi — kabinet ochilmaydi, faqat xodimlar ro'yxatida turadi.")}</span>} />
          </FormSection>
        ) : (
          <FormSection
            title={tr("Kabinet")}
            footer={
              account
                ? tr("Login va parolni o'zingiz kiriting yoki bo'sh qoldiring — bo'sh qoldirilsa avtomatik yaratiladi va bir marta ko'rsatiladi.")
                : tr("Tarbiyachi tizimga kirib, o'ziga biriktirilgan guruhlarga davomat qo'yadi. Oshpaz yoki farrosh kabi xodimlarga kerak emas.")
            }
          >
            <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4">
              <span className="flex-1 text-[15px] text-[var(--color-text)]">{tr("Kabinet ochish")}</span>
              <IosSwitch checked={withAccount} onChange={setWithAccount} label={tr("Kabinet ochish")} />
            </div>
            {account && (
              <>
                <FieldRow label={tr("Login")} htmlFor="new-emp-login" error={show("login")}>
                  <TextInput id="new-emp-login" value={login} onChange={(e) => setLogin(e.target.value)} placeholder={tr("Ixtiyoriy")} autoComplete="off" autoCapitalize="none" />
                </FieldRow>
                <FieldRow label={tr("Parol")} htmlFor="new-emp-password" error={show("password")}>
                  <PasswordInput id="new-emp-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr("Ixtiyoriy")} autoComplete="new-password" />
                </FieldRow>
                {password && (
                  <>
                    <FieldRow label={tr("Tasdiqlash")} htmlFor="new-emp-confirm" error={show("confirm")}>
                      <PasswordInput id="new-emp-confirm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={tr("Parolni tasdiqlang")} autoComplete="new-password" />
                    </FieldRow>
                    <div className="group/row relative px-4 py-3">
                      <PasswordChecklist rules={passwordRules} />
                      <span className={ROW_SEPARATOR} aria-hidden="true" />
                    </div>
                  </>
                )}
              </>
            )}
          </FormSection>
        )}

        {needsGroup && (
          <FormSection
            title={tr("Guruh")}
            footer={show("group") ? <span className="text-[#ff3b30]">{tr(errors.group!)}</span> : tr("Xodim faqat shu guruhni ko'radi va davomatini yuritadi.")}
          >
            {groupsQuery.isLoading ? (
              <Row title={<span className="text-[#8e8e93]">{tr("Guruhlar yuklanmoqda...")}</span>} />
            ) : (groupsQuery.data ?? []).length === 0 ? (
              <Row title={<span className="text-[#8e8e93]">{tr("Avval guruh oching — tarbiyachi qaysi guruhga biriktirilishi kerakligi shundan aniqlanadi.")}</span>} />
            ) : (
              (groupsQuery.data ?? []).map((g) => (
                // Qayta bosilsa tanlov bekor qilinadi
                <CheckRow key={g.id} label={tr(g.name)} checked={groupId === g.id} onClick={() => setGroupId((prev) => (prev === g.id ? "" : g.id))} />
              ))
            )}
          </FormSection>
        )}

        {create.error && (
          <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
            {create.error instanceof ApiError ? tr(create.error.message) : tr("Kutilmagan xatolik yuz berdi")}
          </p>
        )}
        {tried && !valid && !create.error && (
          <p className="px-4 text-[13px] text-[#ff3b30]">{tr("Qizil belgilangan maydonlarni to'ldiring")}</p>
        )}
      </IosSheet>

      {/* Lavozim / fan — ichki varaq: tanlash yoki yangisini qo'shish */}
      <CatalogPickerSheet
        open={open && picker !== null}
        onClose={() => setPicker(null)}
        kind={picker ?? "position"}
        slug={slug}
        selected={picker === "subject" ? subject : position}
        onSelect={(name) => {
          if (picker === "subject") {
            setSubject(name);
          } else {
            setPosition(name);
            // Lavozim o'zgarsa eski fan tanlovi eskiradi
            if (!isSubjectTeacherPosition(name)) setSubject("");
          }
        }}
      />
    </>
  );
}
