"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { CreateEmployeeResult, Employee, EmployeeCredentials, Group } from "@/lib/types";
import { deleteEmployeeWithConfirmation, webauthnErrorMessage } from "@/lib/webauthn";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSection } from "@/components/ios/sheet";
import { FieldRow, FormSection, PasswordInput, TextInput } from "@/components/ios/form";
import { Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { Spinner } from "@/components/ios/spinner";
import { CheckIcon, CopyIcon } from "@/components/ios/icons";
import { IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { formatPositionLabel, isCabinetlessPosition, isGrouplessPosition, isSubjectTeacherPosition } from "@/lib/employee-position";
import { EmployeeTopics } from "@/features/employees/employee-topics";
import { EditEmployeeSheet } from "@/features/employees/edit-employee-sheet";
import { PasswordChecklist, getPasswordRules } from "@/components/ui/password-checklist";
import { Toast, type ToastState } from "@/components/ui/toast";
import { useTr } from "@/i18n/tr";

const LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/;

/**
 * Xodim varag'i — iOS uslubida (SaaS ERP'dagi o'quvchi varag'i tartibida):
 * tepada surat, ism, lavozim va holat; keyin «Ma'lumot», «Kabinet»
 * (login, yangi parol), fan o'qituvchisida «Mavzular», oxirida «Amallar»
 * (tahrirlash, o'chirish).
 *
 * Joriy parol hech qayerda ko'rsatilmaydi — server uni faqat hash ko'rinishida
 * saqlaydi. Admin faqat yangi parol qo'ya oladi. O'chirish admin qurilmasi
 * WebAuthn (Face ID/Windows Hello/PIN) bilan tasdiqlangandan keyin bajariladi.
 */
export function EmployeeDetailModal({
  open,
  onClose,
  slug,
  employee: employeeProp,
  canWrite,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  employee: Employee | null;
  canWrite: boolean;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  // Yopilish animatsiyasida (va o'chirilgandan keyin) varaq bo'shab qolmasin
  const lastEmployee = useRef<Employee | null>(employeeProp);
  if (employeeProp) lastEmployee.current = employeeProp;
  const employee = employeeProp ?? lastEmployee.current;

  const [accountOpen, setAccountOpen] = useState(false);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<EmployeeCredentials | null>(null);

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);

  const [loginInput, setLoginInput] = useState("");
  const [savedLogin, setSavedLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  // Maydonga tegishli xatolar o'sha maydon ostida chiqadi — parol to'g'ri
  // bo'lsa-yu, login xatosi parol ostida chiqib chalg'itmasin
  const [loginError, setLoginError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [topicsManagedByAdmin, setTopicsManagedByAdmin] = useState(false);
  const [topicsSaveError, setTopicsSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAccountOpen(false);
      setGroupIds([]);
      setAccountError(null);
      setCreatedCredentials(null);
      setDeleteConfirming(false);
      setDeleting(false);
      setDeleteError(null);
      setTopicsSaveError(null);
      setEditOpen(false);
    }
  }, [open]);

  // Har bir xodim ochilganda (yoki almashganda) login/parol maydonlari o'sha
  // xodimning haqiqiy loginidan yangilanadi — aks holda oldingi xodimning
  // saqlanmagan qoralamasi qolib ketishi mumkin edi.
  useEffect(() => {
    const login = employee?.tenantUser?.login ?? "";
    setLoginInput(login);
    setSavedLogin(login);
    setNewPassword("");
    setConfirmNewPassword("");
    setCredentialsError(null);
    setLoginError(null);
    setPasswordError(null);
  }, [employee?.id, employee?.tenantUser?.login]);

  // Almashtirgich holati serverdagi qiymatga moslanadi — xodim almashganda yoki
  // saqlangandan keyin (invalidate qilib qayta yuklangach) shu yerdan yangilanadi.
  useEffect(() => {
    setTopicsManagedByAdmin(employee?.topicsManagedByAdmin ?? false);
  }, [employee?.id, employee?.topicsManagedByAdmin]);

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open && accountOpen,
  });

  const credentialsMutation = useMutation({
    mutationFn: () =>
      api.patch<{ login: string }>(`/app/employees/${employee!.id}/credentials`, {
        login: loginInput.trim().toLowerCase() !== savedLogin ? loginInput.trim().toLowerCase() : undefined,
        password: newPassword || undefined,
      }),
    onSuccess: (result) => {
      setSavedLogin(result.login);
      setLoginInput(result.login);
      setNewPassword("");
      setConfirmNewPassword("");
      setCredentialsError(null);
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      setToast({ type: "success", message: "Saqlandi" });
    },
    onError: (err) => {
      setCredentialsError(err instanceof ApiError ? err.message : tr("Saqlab bo'lmadi"));
      setToast({ type: "error", message: tr("Saqlab bo'lmadi") });
    },
  });

  const topicsSettingMutation = useMutation({
    mutationFn: (next: boolean) =>
      api.patch<{ id: string; topicsManagedByAdmin: boolean }>(`/app/employees/${employee!.id}/topics-setting`, {
        managedByAdmin: next,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
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
      setAccountError(err instanceof ApiError ? err.message : tr("Kabinet ochib bo'lmadi"));
    },
  });

  if (!employee) return null;

  const credentialsDirty =
    !!employee.tenantUser && (loginInput.trim().toLowerCase() !== savedLogin || newPassword.length > 0);
  const topicsDirty = topicsManagedByAdmin !== (employee.topicsManagedByAdmin ?? false);
  const dirty = credentialsDirty || topicsDirty;
  const saving = credentialsMutation.isPending || topicsSettingMutation.isPending;

  // Varaq tepasidagi yagona "Saqlash" hamma o'zgargan bo'limlarni (login/parol
  // va "Mavzu qo'shasizmi?" almashtirgichi) birgalikda saqlaydi.
  const handleSave = async () => {
    setCredentialsError(null);
    setLoginError(null);
    setPasswordError(null);
    setTopicsSaveError(null);

    if (credentialsDirty) {
      const trimmedLogin = loginInput.trim().toLowerCase();
      // Login faqat o'zgartirilgan bo'lsa tekshiriladi. Eski hisoblarda login
      // "ism@filial.uz" kabi bo'lishi mumkin — faqat parolni almashtirishda
      // u yangi login qoidasidan o'tmasligi saqlashga to'sqinlik qilmasin
      // (server ham faqat o'zgargan loginni oladi va tekshiradi).
      if (trimmedLogin !== savedLogin && !LOGIN_PATTERN.test(trimmedLogin)) {
        setLoginError(tr("Login lotin harf, raqam, . _ - dan iborat bo'lishi va kamida 3 belgi bo'lishi kerak"));
        return;
      }
      if (newPassword) {
        if (getPasswordRules(newPassword).some((rule) => !rule.met)) {
          setPasswordError("Parol talablarga javob bermaydi");
          return;
        }
        if (newPassword !== confirmNewPassword) {
          setPasswordError("Parollar mos kelmadi");
          return;
        }
      }
      try {
        await credentialsMutation.mutateAsync();
      } catch {
        return;
      }
    }

    if (topicsDirty) {
      try {
        await topicsSettingMutation.mutateAsync(topicsManagedByAdmin);
      } catch (err) {
        setTopicsSaveError(err instanceof ApiError ? err.message : tr("Saqlab bo'lmadi"));
        setToast({ type: "error", message: tr("Saqlab bo'lmadi") });
        return;
      }
    }

    if (!credentialsDirty) {
      setToast({ type: "success", message: "Saqlandi" });
    }
  };

  const toggleGroup = (id: string) => {
    // Xodim faqat bitta guruhga biriktiriladi
    setGroupIds((prev) => (prev.includes(id) ? [] : [id]));
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

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && credentialsDirty && !saving) {
      e.preventDefault();
      handleSave();
    }
  };

  // Kabinet ochilgach login/parol bir marta ko'rsatiladi
  if (createdCredentials) {
    return (
      <IosSheet open={open} onClose={onClose} cancelLabel="Yopish" title={tr("Kabinet ochildi")} footer={<SheetPrimaryButton onClick={onClose}>{tr("Tayyor")}</SheetPrimaryButton>}>
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#34c759]/[0.14] text-[#34c759]">
            <CheckIcon className="h-7 w-7" strokeWidth={2.6} />
          </span>
          <p className="px-6 text-[13px] text-[#8e8e93]">{tr("Login va parolni xodimga bering — parol qayta ko'rsatilmaydi.")}</p>
        </div>
        <SheetSection>
          <CopyRow label={tr("Login")} value={createdCredentials.login} />
          <CopyRow label={tr("Parol")} value={createdCredentials.password} />
        </SheetSection>
      </IosSheet>
    );
  }

  const positionLabel = formatPositionLabel(employee.position, employee.subjects);
  const groupNames = (employee.teachingGroups ?? []).map((link) => link.group?.name ?? tr("Guruh"));
  const cabinetless = isCabinetlessPosition(employee.position);

  return (
    <>
      <IosSheet
        open={open && !editOpen}
        onClose={onClose}
        cancelLabel="Yopish"
        title={tr("Xodim")}
        action={dirty ? { label: "Saqlash", onClick: handleSave, loading: saving } : undefined}
      >
        {/* Bosh qism: surat, ism, lavozim, holat */}
        <div className="flex flex-col items-center gap-2 pt-1">
          <EmployeePhoto employee={employee} size={88} fallback={initials(employee.fullName)} className="text-[30px]" />
          <p className="px-6 text-center text-[20px] font-bold leading-tight text-[var(--color-text)]">{tr(employee.fullName)}</p>
          <p className="-mt-1 px-6 text-center text-[15px] text-[#8e8e93]">{tr(positionLabel)}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill color={employee.isActive ? IOS.green : IOS.gray}>{tr(employee.isActive ? "Faol" : "Nofaol")}</Pill>
            <Pill color={IOS.gray} title={tr("Face ID raqami")}>
              ID {employee.employeeNo}
            </Pill>
          </div>
        </div>

        <SheetSection title={tr("Ma'lumot")}>
          <SheetRow label={tr("Telefon")}>
            {employee.phone ? (
              <a href={`tel:${employee.phone}`} className="tabular-nums text-[var(--color-primary)]">
                {employee.phone}
              </a>
            ) : (
              tr("Kiritilmagan")
            )}
          </SheetRow>
          <SheetRow label={tr("Lavozim")}>
            <span className="block truncate">{tr(positionLabel)}</span>
          </SheetRow>
          {groupNames.length > 0 && (
            <SheetRow label={tr("Guruh")}>
              <span className="block truncate">{groupNames.map((n) => tr(n)).join(", ")}</span>
            </SheetRow>
          )}
        </SheetSection>

        {/* Kabinet: login va parol */}
        {employee.tenantUser ? (
          <FormSection
            title={tr("Kabinet")}
            footer={
              credentialsError ? (
                <span className="text-[#ff3b30]">{tr(credentialsError)}</span>
              ) : canWrite ? (
                tr("Joriy parol ko'rsatilmaydi. Xodim parolini unutgan bo'lsa — yangi parol qo'ying.")
              ) : undefined
            }
          >
            <FieldRow label={tr("Login")} htmlFor="employee-login" error={loginError ?? undefined}>
              <TextInput
                id="employee-login"
                value={loginInput}
                onChange={(e) => {
                  setLoginInput(e.target.value);
                  setLoginError(null);
                }}
                onKeyDown={onEnter}
                disabled={!canWrite || saving}
                autoComplete="off"
                className="text-right"
              />
            </FieldRow>
            {canWrite && (
              <FieldRow label={tr("Yangi parol")} htmlFor="employee-new-password" error={!newPassword ? (passwordError ?? undefined) : undefined}>
                <PasswordInput
                  id="employee-new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder={tr("O'zgartirmaslik uchun bo'sh qoldiring")}
                  autoComplete="new-password"
                  disabled={saving}
                />
              </FieldRow>
            )}
            {canWrite && newPassword && (
              <FieldRow label={tr("Tasdiqlash")} htmlFor="employee-confirm-password" error={passwordError ?? undefined}>
                <PasswordInput
                  id="employee-confirm-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder={tr("Yangi parolni tasdiqlang")}
                  autoComplete="new-password"
                  disabled={saving}
                />
              </FieldRow>
            )}
            {canWrite && newPassword && (
              <div className="group/row relative px-4 py-3">
                <PasswordChecklist rules={getPasswordRules(newPassword, confirmNewPassword)} />
                <span className={ROW_SEPARATOR} aria-hidden="true" />
              </div>
            )}
          </FormSection>
        ) : (
          <SheetSection
            title={tr("Kabinet")}
            footer={
              accountError ? (
                <span className="text-[#ff3b30]">{tr(accountError)}</span>
              ) : cabinetless ? (
                tr("Bu lavozim tizimga kirmaydi — kabinet kerak emas")
              ) : accountOpen ? (
                tr("Login va parol avtomatik generatsiya qilinadi va bir marta ko'rsatiladi.")
              ) : undefined
            }
          >
            {!accountOpen ? (
              <Row
                title={tr(cabinetless ? "Kabinetsiz lavozim" : "Kabinet ochilmagan")}
                value={
                  canWrite && !cabinetless ? (
                    <button type="button" onClick={() => setAccountOpen(true)} className="font-medium text-[var(--color-primary)] transition-opacity active:opacity-50">
                      {tr("Kabinet ochish")}
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {!isGrouplessPosition(employee.position) &&
                  (!groups ? (
                    <Row title={<span className="text-[#8e8e93]">{tr("Guruhlar yuklanmoqda...")}</span>} />
                  ) : groups.length === 0 ? (
                    <Row title={<span className="text-[#8e8e93]">{tr("Avval guruh oching.")}</span>} />
                  ) : (
                    groups.map((group) => {
                      const selected = groupIds.includes(group.id);
                      return (
                        <div key={group.id} className="group/row relative">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => toggleGroup(group.id)}
                            className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
                          >
                            <span className="min-w-0 flex-1 truncate py-3 text-[15px] text-[var(--color-text)]">{tr(group.name)}</span>
                            {selected && <CheckIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
                          </button>
                          <span className={ROW_SEPARATOR} aria-hidden="true" />
                        </div>
                      );
                    })
                  ))}
                <div className="group/row relative flex gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      setAccountError(null);
                    }}
                    className="h-10 flex-1 rounded-full bg-[#767680]/[0.12] text-[15px] font-semibold text-[var(--color-text)] transition-transform active:scale-[0.97]"
                  >
                    {tr("Bekor qilish")}
                  </button>
                  <button
                    type="button"
                    disabled={accountMutation.isPending}
                    onClick={() => {
                      if (groupIds.length === 0 && !isGrouplessPosition(employee.position)) {
                        setAccountError(tr("Kamida bitta guruh tanlang"));
                        return;
                      }
                      setAccountError(null);
                      accountMutation.mutate();
                    }}
                    className="flex h-10 flex-1 items-center justify-center rounded-full bg-[var(--color-primary)] text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
                  >
                    {accountMutation.isPending ? <Spinner className="h-4 w-4 text-white" /> : tr("Ochish")}
                  </button>
                  <span className={ROW_SEPARATOR} aria-hidden="true" />
                </div>
              </>
            )}
          </SheetSection>
        )}

        {isSubjectTeacherPosition(employee.position) && (
          <EmployeeTopics slug={slug} employeeId={employee.id} managedByAdmin={topicsManagedByAdmin} onManagedByAdminChange={setTopicsManagedByAdmin} />
        )}
        {topicsSaveError && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(topicsSaveError)}</p>}

        {canWrite && (
          <SheetSection title={tr("Amallar")}>
            <Row leading={<IosIcon icon={Pencil} tint="blue" size={30} />} title={tr("Tahrirlash")} subtitle={tr("Ism, telefon, lavozim, guruh, surat, holat")} onClick={() => setEditOpen(true)} />
            {!deleteConfirming ? (
              <Row
                leading={<IosIcon icon={Trash2} tint="red" size={30} />}
                title={<span className="text-[#ff3b30]">{tr("O'chirish")}</span>}
                onClick={() => setDeleteConfirming(true)}
                chevron={false}
              />
            ) : (
              // Tasdiqlash — varaq ichida ikkinchi bosqich
              <div className="group/row relative space-y-3 bg-[#ff3b30]/[0.06] px-4 py-3.5">
                <p className="text-[13.5px] leading-snug text-[#ff3b30]">
                  &quot;{tr(employee.fullName)}
                  {tr("\"ni butunlay o'chirmoqchimisiz? Uning davomat va oylik tarixi ham qaytarib bo'lmas tarzda o'chadi.")}
                </p>
                {employee.isActive && (
                  <p className="text-[12.5px] leading-snug text-[#8e8e93]">{tr("Ishdan ketgan bo'lsa, tarixini saqlab qolish uchun «Tahrirlash»da nofaol qiling.")}</p>
                )}
                {deleteError && <p className="text-[12.5px] text-[#ff3b30]">{tr(deleteError)}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setDeleteConfirming(false);
                      setDeleteError(null);
                    }}
                    className="h-10 flex-1 rounded-full bg-white text-[15px] font-semibold text-[var(--color-text)] transition-transform active:scale-[0.97]"
                  >
                    {tr("Qoldirish")}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="flex h-10 flex-1 items-center justify-center rounded-full bg-[#ff3b30] text-[15px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
                  >
                    {deleting ? <Spinner className="h-4 w-4 text-white" /> : tr("O'chirish")}
                  </button>
                </div>
                <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
              </div>
            )}
          </SheetSection>
        )}

      </IosSheet>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {canWrite && <EditEmployeeSheet open={open && editOpen} onClose={() => setEditOpen(false)} slug={slug} employee={employee} />}
    </>
  );
}

/** Bir martalik ko'rsatiladigan login/parol qatori — nusxalash tugmasi bilan */
function CopyRow({ label, value }: { label: string; value: string }) {
  const tr = useTr();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard ruxsati yo'q — qiymat ekranda ko'rinib turadi
    }
  };
  return (
    <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4">
      <span className="w-[72px] shrink-0 text-[15px] text-[var(--color-text)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[15px] text-[var(--color-text)]">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={tr("Nusxalash")}
        className={clsx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#767680]/[0.12]",
          copied ? "text-[#34c759]" : "text-[var(--color-primary)]",
        )}
      >
        {copied ? <CheckIcon className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <CopyIcon className="h-[18px] w-[18px]" />}
      </button>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}
