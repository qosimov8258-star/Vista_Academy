"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CreateChildResult, ChildCredentials, Group } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordChecklist, getPasswordRules } from "@/components/ui/password-checklist";
import { CredentialRow } from "@/components/ui/credential-row";
import { EyeIcon, EyeOffIcon, CheckIcon, PencilIcon } from "@/components/ui/icons";
import { prepareChildPhoto } from "@/lib/child-photo";
import { initials } from "@/components/ui/avatar";
import { validateUzbekPhone } from "@/lib/phone";
import { useTr } from "@/i18n/tr";

// `hasGroups` mavjud faol guruhlar borligiga qarab qayta quriladi: guruhlar
// bo'lsa birini tanlash shart, hech qanday faol guruh bo'lmasa (masalan
// filial hali guruh yaratmagan) bola guruhsiz ham qo'shiladi.
function buildSchema(hasGroups: boolean) {
  return z
    .object({
      groupId: hasGroups ? z.string().min(1, "Guruhni tanlang") : z.string().optional(),
      lastName: z.string().min(2, "Familiya kamida 2 belgi"),
      firstName: z.string().min(2, "Ism kamida 2 belgi"),
      gender: z.enum(["MALE", "FEMALE"], { message: "Jinsini tanlang" }),
      birthDate: z.string().optional(),
      guardianFullName: z.string().min(2, "Ota-ona ismi kamida 2 belgi"),
      guardianRelation: z.enum(["MOTHER", "FATHER", "GRANDPARENT", "OTHER"]),
      guardianPhone: z
        .string()
        .min(1, "Telefon raqami kiritilishi shart")
        .superRefine((value, ctx) => {
          const error = validateUzbekPhone(value);
          if (error === "prefix") {
            ctx.addIssue({ code: "custom", message: "Telefon raqami +998 bilan boshlanishi kerak" });
          } else if (error === "length") {
            ctx.addIssue({ code: "custom", message: "Telefon raqami 9 xonali bo'lishi kerak (+998 dan keyin)" });
          } else if (error === "code") {
            ctx.addIssue({
              code: "custom",
              message: "Bunday operator kodi mavjud emas (masalan: 90, 91, 93, 94, 95, 97, 98, 99)",
            });
          }
        }),
      // Ixtiyoriy — bo'sh qoldirilsa backend avtomatik generatsiya qiladi
      guardianPassword: z.string().optional(),
      guardianConfirmPassword: z.string().optional(),
      // Birinchi hisob-fakturani bola bilan birga yaratish (ixtiyoriy)
      createInvoice: z.boolean().optional(),
      invoiceAmount: z.string().optional(),
      invoiceDueDate: z.string().optional(),
    })
    .superRefine((values, ctx) => {
      if (values.createInvoice) {
        if (!(Number(values.invoiceAmount) > 0)) {
          ctx.addIssue({ code: "custom", path: ["invoiceAmount"], message: "Summani kiriting" });
        }
        if (!values.invoiceDueDate) {
          ctx.addIssue({ code: "custom", path: ["invoiceDueDate"], message: "To'lov muddatini tanlang" });
        }
      }
      if (!values.guardianPassword) return;
      const unmet = getPasswordRules(values.guardianPassword).some((rule) => !rule.met);
      if (unmet) {
        ctx.addIssue({ code: "custom", path: ["guardianPassword"], message: "Parol talablarga javob bermaydi" });
      }
      if (values.guardianPassword !== values.guardianConfirmPassword) {
        ctx.addIssue({ code: "custom", path: ["guardianConfirmPassword"], message: "Parollar mos kelmadi" });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function CreateChildModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoImage, setPhotoImage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoChecking, setPhotoChecking] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [createdCredentials, setCreatedCredentials] = useState<ChildCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });
  const activeGroups = useMemo(() => groups?.filter((group) => group.status === "ACTIVE") ?? [], [groups]);
  const schema = useMemo(() => buildSchema(activeGroups.length > 0), [activeGroups.length]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { guardianRelation: "MOTHER", birthDate: "" },
  });

  const lastName = watch("lastName");
  const firstName = watch("firstName");
  const createInvoice = watch("createInvoice");
  const password = watch("guardianPassword");
  const confirmPassword = watch("guardianConfirmPassword");
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

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const result = await api.post<CreateChildResult>("/app/children", {
        groupId: values.groupId || undefined,
        lastName: values.lastName,
        firstName: values.firstName,
        gender: values.gender,
        birthDate: values.birthDate || undefined,
        guardianFullName: values.guardianFullName,
        guardianRelation: values.guardianRelation,
        guardianPhone: values.guardianPhone,
        guardianPassword: values.guardianPassword || undefined,
      });
      // Surat bola yaratilgandan keyin alohida so'rov bilan yuklanadi; shu so'rov
      // muvaffaqiyatsiz bo'lsa ham bola yozuvi allaqachon yaratilgan hisoblanadi.
      if (photoImage) {
        await api.put(`/app/children/${result.id}/avatar`, { image: photoImage }).catch(() => {});
      }
      // Birinchi hisob-faktura: bola allaqachon yaratilgan, shuning uchun xato bo'lsa
      // ham bola yozuvi qoladi — hisob-fakturani Moliya sahifasidan qayta yaratish mumkin.
      if (values.createInvoice) {
        const now = new Date();
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        await api
          .post("/app/invoices", { childId: result.id, amount: Number(values.invoiceAmount), period, dueDate: values.invoiceDueDate })
          .catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["invoices", slug] });
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      setPhotoImage(null);
      setPhotoError(null);
      if (result.credentials) {
        // Login/parol shu javobda bir marta keladi — yopishdan oldin ko'rsatiladi.
        setCreatedCredentials(result.credentials);
      } else {
        reset();
        onClose();
      }
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const handleClose = () => {
    reset();
    setServerError(null);
    setPhotoImage(null);
    setPhotoError(null);
    setCreatedCredentials(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  if (createdCredentials) {
    return (
      <Modal open={open} onClose={handleClose} title={tr("Bola qo'shildi")}>
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
              <CheckIcon className="h-6 w-6" />
            </span>
            <p className="text-sm text-[var(--color-text-muted)]">
              {tr("Ota-ona kabineti ochildi. Login va parolni ota-onaga bering — parol qayta ko'rsatilmaydi.")}
            </p>
          </div>
          <CredentialRow label={tr("Login")} value={createdCredentials.login} />
          <CredentialRow label={tr("Parol")} value={createdCredentials.password} />
          <div className="flex justify-end pt-1">
            <Button type="button" onClick={handleClose}>
              {tr("Yopish")}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={tr("Yangi bola")}>
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="group relative shrink-0">
            {photoImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL, Next optimizatsiyasi kerak emas
              <img
                src={photoImage}
                alt={tr("Bola surati")}
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
              aria-label={tr("Bola suratini tanlash")}
              title={tr("Surat qo'yish")}
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
            {photoChecking ? "Tekshirilmoqda..." : photoImage ? "Rasmni almashtirish" : tr("Surat qo'yish (ixtiyoriy)")}
          </button>
          {photoError && (
            <p role="alert" className="max-w-[320px] text-center text-[12.5px] text-[var(--color-danger)]">
              {tr(photoError)}
            </p>
          )}
        </div>

        {/* Familiya oldinda: ro'yxatlar va hujjatlar "Familiya Ism" tartibida */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={tr("Familiya")}
            placeholder={tr("Umaraliyev")}
            error={errors.lastName?.message}
            {...register("lastName")}
          />
          <Input label={tr("Ism")} placeholder={tr("Usmon")} error={errors.firstName?.message} {...register("firstName")} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label={tr("Jinsi")} defaultValue="" error={errors.gender?.message} {...register("gender")}>
            <option value="" disabled>
              {tr("Tanlang")}
            </option>
            <option value="MALE">{tr("O'g'il bola")}</option>
            <option value="FEMALE">{tr("Qiz bola")}</option>
          </Select>
          <Select
            label={activeGroups.length > 0 ? tr("Guruh") : tr("Guruh (ixtiyoriy)")}
            defaultValue=""
            error={errors.groupId?.message}
            {...register("groupId")}
          >
            <option value="" disabled={activeGroups.length > 0}>
              {activeGroups.length > 0 ? tr("Tanlang") : "Tanlanmagan"}
            </option>
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {tr(group.name)} ({group._count?.children ?? 0}/{tr(group.capacity)})
              </option>
            ))}
          </Select>
        </div>

        <Input
          label={tr("Tug'ilgan sana (ixtiyoriy)")}
          type="date"
          error={errors.birthDate?.message}
          hint={tr("Saqlanganda bolaga qisqa ID beriladi (masalan id14732)")}
          {...register("birthDate")}
        />

        <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
          <p className="text-sm font-medium text-[var(--color-text)]">{tr("Aloqa uchun ota-ona")}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
            <Input
              label={tr("Ismi va familiyasi")}
              placeholder={tr("Umaraliyeva Aziza")}
              error={errors.guardianFullName?.message}
              {...register("guardianFullName")}
            />
            <Select label={tr("Kim bo'ladi")} {...register("guardianRelation")}>
              <option value="MOTHER">{tr("Onasi")}</option>
              <option value="FATHER">{tr("Otasi")}</option>
              <option value="GRANDPARENT">{tr("Buvi/bobo")}</option>
              <option value="OTHER">{tr("Boshqa")}</option>
            </Select>
          </div>
          <Input
            label={tr("Telefon raqami")}
            type="tel"
            placeholder="+998 90 123 45 67"
            maxLength={13}
            hint={tr("Xuddi shu raqam bilan yana bola qo'shilsa, ikkalasi bir ota-onaga bog'lanadi")}
            error={errors.guardianPhone?.message}
            {...register("guardianPhone")}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <Input
                label={tr("Parol (ixtiyoriy)")}
                type={showPassword ? "text" : "password"}
                placeholder={tr("Bo'sh qoldirilsa avtomatik beriladi")}
                error={errors.guardianPassword?.message}
                {...register("guardianPassword")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[38px] cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
                aria-label={showPassword ? "Parolni yashirish" : tr("Parolni ko'rsatish")}
              >
                {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Input
                label={tr("Parolni tasdiqlang")}
                type={showConfirmPassword ? "text" : "password"}
                error={errors.guardianConfirmPassword?.message}
                {...register("guardianConfirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-[38px] cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
                aria-label={showConfirmPassword ? "Parolni yashirish" : tr("Parolni ko'rsatish")}
              >
                {showConfirmPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {password && (
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3">
              <PasswordChecklist rules={passwordRules} />
            </div>
          )}
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-primary)]" {...register("createInvoice")} />
            <span>
              <span className="block text-sm font-medium text-[var(--color-text)]">{tr("Birinchi hisob-fakturani yaratish")}</span>
              <span className="block text-xs text-[var(--color-text-muted)]">{tr("Joriy oy uchun to'lov summasi va muddatini kiriting.")}</span>
            </span>
          </label>
          {createInvoice && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label={tr("Summa (UZS)")} type="number" placeholder="850000" error={errors.invoiceAmount?.message} {...register("invoiceAmount")} />
              <Input label={tr("To'lov muddati")} type="date" error={errors.invoiceDueDate?.message} {...register("invoiceDueDate")} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {tr("Bekor qilish")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {tr("Yaratish")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
