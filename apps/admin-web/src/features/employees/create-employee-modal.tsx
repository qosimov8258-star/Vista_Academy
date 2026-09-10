"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CreateEmployeeResult, EmployeeCredentials, Group, Position } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusInput, type FieldStatus } from "@/components/ui/status-input";
import { CredentialRow } from "@/components/ui/credential-row";
import { PasswordChecklist, getPasswordRules } from "@/components/ui/password-checklist";
import { PositionsModal } from "@/features/employees/positions-modal";
import { SubjectsModal } from "@/features/employees/subjects-modal";
import { PencilIcon, ChevronDownIcon, CheckIcon, EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { initials } from "@/components/ui/avatar";
import { prepareChildPhoto } from "@/lib/child-photo";

const schema = z
  .object({
    lastName: z.string().min(2, "Familiya kamida 2 belgi"),
    firstName: z.string().min(2, "Ism kamida 2 belgi"),
    phone: z
      .string()
      .optional()
      .refine((value) => !value || /\d[\d\s()+-]{7,}/.test(value), "Telefon raqami noto'g'ri"),
    // Kabinet ixtiyoriy: oshpaz yoki farrosh tizimga kirmaydi
    withAccount: z.boolean(),
    groupIds: z.array(z.string()),
    // Login/parol ixtiyoriy — bo'sh qoldirilsa backend avtomatik generatsiya qiladi
    login: z.string().optional(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.withAccount) return;
    if (values.groupIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["groupIds"], message: "Kamida bitta guruh tanlang" });
    }
    if (values.login && values.login.trim().length < 3) {
      ctx.addIssue({ code: "custom", path: ["login"], message: "Login kamida 3 belgi bo'lishi kerak" });
    }
    if (values.password) {
      const unmet = getPasswordRules(values.password).some((rule) => !rule.met);
      if (unmet) {
        ctx.addIssue({ code: "custom", path: ["password"], message: "Parol talablarga javob bermaydi" });
      }
      if (values.password !== values.confirmPassword) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Parollar mos kelmadi" });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

const SUBJECT_TEACHER_POSITION = "fan o'qituvchisi";

/** Turli tirnoq belgilari (', ', `) bilan kiritilgan lavozim nomini solishtirish uchun. */
const normalizePosition = (value: string) => value.trim().toLowerCase().replace(/[''`]/g, "'");

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
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoImage, setPhotoImage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoChecking, setPhotoChecking] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [positionName, setPositionName] = useState(initialPosition?.name ?? "");
  const [positionError, setPositionError] = useState<string | null>(null);
  const [positionsModalOpen, setPositionsModalOpen] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectsModalOpen, setSubjectsModalOpen] = useState(false);
  const isSubjectTeacher = normalizePosition(positionName) === SUBJECT_TEACHER_POSITION;
  const [createdCredentials, setCreatedCredentials] = useState<EmployeeCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setPositionName(initialPosition?.name ?? "");
      setPositionError(null);
      setSubjects([]);
      setSubjectsError(null);
      setCreatedCredentials(null);
    }
  }, [open, initialPosition]);

  useEffect(() => {
    // Lavozim "Fan o'qituvchisi"dan boshqasiga o'zgarsa, eski fan tanlovi eskirgan hisoblanadi
    if (!isSubjectTeacher) {
      setSubjects([]);
      setSubjectsError(null);
    }
  }, [isSubjectTeacher]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { withAccount: false, groupIds: [] },
  });

  const withAccount = watch("withAccount");
  const groupIds = watch("groupIds");
  const lastName = watch("lastName");
  const firstName = watch("firstName");
  const password = watch("password");
  const confirmPassword = watch("confirmPassword");
  const passwordRules = getPasswordRules(password ?? "", confirmPassword ?? "");

  const handlePhotoPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPhotoError(null);
    setPhotoChecking(true);
    try {
      const result = await prepareChildPhoto(file);
      if (!result.ok) {
        setPhotoError(result.reason);
        return;
      }
      setPhotoImage(result.image);
    } finally {
      setPhotoChecking(false);
    }
  };

  const nameFieldStatus = (value: string | undefined, dirty: boolean | undefined, error: string | undefined): FieldStatus => {
    if (error) return "error";
    if (dirty && value && value.trim().length >= 2) return "success";
    return "neutral";
  };

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open && withAccount,
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const result = await api.post<CreateEmployeeResult>("/app/employees", {
        lastName: values.lastName,
        firstName: values.firstName,
        phone: values.phone || undefined,
        position: positionName.trim(),
        subjects: isSubjectTeacher ? subjects : undefined,
        account: values.withAccount
          ? {
              groupIds: values.groupIds,
              login: values.login?.trim() || undefined,
              password: values.password || undefined,
            }
          : undefined,
      });
      if (photoImage) {
        // Rasm ixtiyoriy — yuklab bo'lmasa ham xodim yaratilgan hisoblanadi
        await api.put(`/app/employees/${result.employee.id}/avatar`, { image: photoImage }).catch(() => {});
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      queryClient.invalidateQueries({ queryKey: ["groups", slug] });
      queryClient.invalidateQueries({ queryKey: ["positions", slug] });
      setPhotoImage(null);
      setPhotoError(null);
      if (result.credentials) {
        // Login/parol shu javobda bir marta keladi — yopishdan oldin ko'rsatiladi.
        setCreatedCredentials(result.credentials);
      } else {
        reset();
        setPositionName("");
        onClose();
      }
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const toggleGroup = (id: string) => {
    setValue("groupIds", groupIds.includes(id) ? groupIds.filter((g) => g !== id) : [...groupIds, id], {
      shouldValidate: true,
    });
  };

  const handleClose = () => {
    reset();
    setServerError(null);
    setPhotoImage(null);
    setPhotoError(null);
    setPositionName("");
    setPositionError(null);
    setSubjects([]);
    setSubjectsError(null);
    setCreatedCredentials(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  if (createdCredentials) {
    return (
      <Modal open={open} onClose={handleClose} title="Xodim yaratildi">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
              <CheckIcon className="h-6 w-6" />
            </span>
            <p className="text-sm text-[var(--color-text-muted)]">
              Kabinet ochildi. Login va parolni xodimga bering — parol qayta ko&apos;rsatilmaydi.
            </p>
          </div>
          <CredentialRow label="Login" value={createdCredentials.login} />
          <CredentialRow label="Parol" value={createdCredentials.password} />
          <div className="flex justify-end pt-1">
            <Button type="button" onClick={handleClose}>
              Yopish
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Yangi xodim">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          if (positionName.trim().length < 2) {
            setPositionError("Lavozimni tanlang yoki yarating");
            return;
          }
          if (isSubjectTeacher && subjects.length === 0) {
            setSubjectsError("Kamida bitta fan tanlang");
            return;
          }
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        <h1 className="font-heading text-center text-[28px] font-extrabold tracking-tight text-[var(--color-primary)]">
          Vista Academy
        </h1>

        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="group relative shrink-0">
            {photoImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL, Next optimizatsiyasi kerak emas
              <img
                src={photoImage}
                alt="Xodim surati"
                width={72}
                height={72}
                className="h-[72px] w-[72px] shrink-0 rounded-full object-cover ring-1 ring-inset ring-[rgba(16,24,40,0.06)]"
              />
            ) : (
              <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[26px] font-semibold text-[var(--color-primary)] ring-1 ring-inset ring-[rgba(16,24,40,0.06)]">
                {initials(`${firstName ?? ""} ${lastName ?? ""}`) || "?"}
              </span>
            )}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoChecking}
              aria-label="Xodim suratini tanlash"
              title="Surat qo'yish"
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-[var(--dur-fast)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none disabled:cursor-wait disabled:opacity-100 motion-reduce:transition-none"
            >
              {photoChecking ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <PencilIcon className="h-5 w-5" />
              )}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handlePhotoPick}
            />
          </div>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoChecking}
            className="cursor-pointer text-[12.5px] font-medium text-[var(--color-primary)] hover:underline disabled:opacity-60"
          >
            {photoChecking ? "Tekshirilmoqda..." : photoImage ? "Suratni almashtirish" : "Surat qo'yish"}
          </button>
          {photoError && (
            <p role="alert" className="max-w-[320px] text-center text-[12.5px] text-[var(--color-danger)]">
              {photoError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatusInput
            label="Ism"
            placeholder="Dilnoza"
            error={errors.firstName?.message}
            status={nameFieldStatus(firstName, dirtyFields.firstName, errors.firstName?.message)}
            {...register("firstName")}
          />
          {/* Fullname birlashtirishda familiya oldinda: ro'yxatlar va
              hujjatlar "Familiya Ism" tartibida saqlanadi */}
          <StatusInput
            label="Familiya"
            placeholder="Yusupova"
            error={errors.lastName?.message}
            status={nameFieldStatus(lastName, dirtyFields.lastName, errors.lastName?.message)}
            {...register("lastName")}
          />
        </div>

        <Input
          label="Telefon raqami"
          type="tel"
          placeholder="+998 90 123 45 67"
          error={errors.phone?.message}
          {...register("phone")}
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Lavozim</span>
          <button
            type="button"
            onClick={() => setPositionsModalOpen(true)}
            className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-left text-sm text-[var(--color-text)] outline-none transition-colors hover:bg-[var(--color-surface-hover)] focus:border-[var(--color-primary)]"
          >
            <span className={positionName ? undefined : "text-gray-400"}>
              {positionName || "Lavozimni tanlang yoki yarating"}
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
          {positionError && <span className="mt-1 block text-xs text-[#dc2626]">{positionError}</span>}
        </div>

        {isSubjectTeacher && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Fanlar</span>
            <button
              type="button"
              onClick={() => setSubjectsModalOpen(true)}
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-left text-sm text-[var(--color-text)] outline-none transition-colors hover:bg-[var(--color-surface-hover)] focus:border-[var(--color-primary)]"
            >
              <span className={subjects.length > 0 ? undefined : "text-gray-400"}>
                {subjects.length > 0 ? subjects.join(", ") : "Fanlarni tanlang yoki yarating"}
              </span>
              <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
            </button>
            {subjectsError && <span className="mt-1 block text-xs text-[#dc2626]">{subjectsError}</span>}
          </div>
        )}

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
              {...register("withAccount")}
            />
            <span>
              <span className="block text-sm font-medium text-[var(--color-text)]">Kabinet ochish</span>
              <span className="block text-xs text-[var(--color-text-muted)]">
                Tarbiyachi tizimga kirib, o&apos;ziga biriktirilgan guruhlarga davomat qo&apos;yadi va kundalik
                hisobot to&apos;ldiradi. Oshpaz yoki farrosh kabi xodimlarga kerak emas.
              </span>
            </span>
          </label>

          {withAccount && (
            <div className="mt-4 space-y-4 border-t border-[var(--color-border)] pt-4">
              <p className="text-xs text-[var(--color-text-muted)]">
                Login va parolni o&apos;zingiz kiriting yoki bo&apos;sh qoldiring — bo&apos;sh qoldirilsa avtomatik
                yaratiladi va bir marta ko&apos;rsatiladi.
              </p>

              <Input
                label="Login"
                placeholder="dilnoza.yusupova (ixtiyoriy)"
                autoComplete="off"
                error={errors.login?.message}
                {...register("login")}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[13px] font-medium text-[var(--color-text)]" htmlFor="password">
                    Parol
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Ixtiyoriy"
                      autoComplete="new-password"
                      className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 pr-10 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60 outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
                      aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    >
                      {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password?.message && (
                    <span className="mt-1.5 block text-[13px] text-[var(--color-danger)]">{errors.password.message}</span>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-medium text-[var(--color-text)]" htmlFor="confirmPassword">
                    Parolni tasdiqlang
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Ixtiyoriy"
                      autoComplete="new-password"
                      className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 pr-10 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60 outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]"
                      {...register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
                      aria-label={showConfirmPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    >
                      {showConfirmPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword?.message && (
                    <span className="mt-1.5 block text-[13px] text-[var(--color-danger)]">{errors.confirmPassword.message}</span>
                  )}
                </div>
              </div>

              {password && (
                <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3">
                  <PasswordChecklist rules={passwordRules} />
                </div>
              )}

              <div>
                <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Guruhlari</span>
                {!groups ? (
                  <p className="text-xs text-[var(--color-text-muted)]">Guruhlar yuklanmoqda...</p>
                ) : groups.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Avval guruh oching — tarbiyachi qaysi guruhga biriktirilishi kerakligi shundan aniqlanadi.
                  </p>
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
                {errors.groupIds?.message && (
                  <span className="mt-1.5 block text-xs text-[var(--color-danger)]">{errors.groupIds.message}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Yaratish
          </Button>
        </div>
      </form>

      <PositionsModal
        open={positionsModalOpen}
        onClose={() => setPositionsModalOpen(false)}
        slug={slug}
        selected={positionName}
        onSelect={(name) => {
          setPositionName(name);
          setPositionError(null);
        }}
      />

      <SubjectsModal
        open={subjectsModalOpen}
        onClose={() => setSubjectsModalOpen(false)}
        slug={slug}
        selected={subjects}
        onToggle={(name) => {
          setSubjects((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
          setSubjectsError(null);
        }}
      />
    </Modal>
  );
}
