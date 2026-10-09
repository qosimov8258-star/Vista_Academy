"use client";

import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CreateChildResult, ChildCredentials, Group } from "@/lib/types";
import { PasswordChecklist, getPasswordRules } from "@/components/ui/password-checklist";
import { CredentialRow } from "@/components/ui/credential-row";
import { CameraIcon, CheckIcon } from "@/components/ui/icons";
import { Toast, type ToastState } from "@/components/ui/toast";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { DobPicker, FieldRow, FormSection, IosSwitch, MoneyInput, PasswordInput, Segmented, SelectInput, TextInput } from "@/components/ios/form";
import { Spinner } from "@/components/ios/spinner";
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

/** Xatolar formadagi tartibda — toast birinchisini aytadi */
const FIELD_ORDER: (keyof FormValues)[] = [
  "lastName",
  "firstName",
  "gender",
  "groupId",
  "birthDate",
  "guardianFullName",
  "guardianRelation",
  "guardianPhone",
  "guardianPassword",
  "guardianConfirmPassword",
  "invoiceAmount",
  "invoiceDueDate",
];

/**
 * Yangi bola — iOS varag'ida. Bo'limlar: surat, bola, ota-ona, ota-ona
 * kabineti paroli (ixtiyoriy), birinchi hisob-faktura (ixtiyoriy).
 * Saqlangach ota-ona login/paroli shu varaqning o'zida bir marta ko'rsatiladi.
 */
export function CreateChildModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoImage, setPhotoImage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoChecking, setPhotoChecking] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [createdCredentials, setCreatedCredentials] = useState<ChildCredentials | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });
  const activeGroups = useMemo(() => groups?.filter((group) => group.status === "ACTIVE") ?? [], [groups]);
  const schema = useMemo(() => buildSchema(activeGroups.length > 0), [activeGroups.length]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { guardianRelation: "MOTHER", birthDate: "", groupId: "" },
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
    if (mutation.isPending) return;
    reset();
    setServerError(null);
    setPhotoImage(null);
    setPhotoError(null);
    setCreatedCredentials(null);
    onClose();
  };

  // To'liq emas: nima yetishmasligini toast aytadi, klaviatura yopiladi
  const onInvalid = (formErrors: FieldErrors<FormValues>) => {
    const first = FIELD_ORDER.find((key) => formErrors[key]);
    const message = first ? formErrors[first]?.message : undefined;
    setToast({ type: "error", message: tr(message ?? "Majburiy maydonlarni to'ldiring") });
    (document.activeElement as HTMLElement | null)?.blur?.();
  };
  const submit = handleSubmit((values) => {
    setServerError(null);
    mutation.mutate(values);
  }, onInvalid);

  const saving = isSubmitting || mutation.isPending;
  const err = (key: keyof FormValues) => errors[key]?.message as string | undefined;

  if (createdCredentials) {
    return (
      <IosSheet
        open={open}
        onClose={handleClose}
        cancelLabel="Yopish"
        title={tr("Bola qo'shildi")}
        footer={<SheetPrimaryButton onClick={handleClose}>{tr("Tayyor")}</SheetPrimaryButton>}
      >
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#34c759]/[0.14] text-[#34c759]">
            <CheckIcon className="h-8 w-8" strokeWidth={2.6} />
          </span>
          <p className="max-w-[360px] text-[14px] text-[#6d6d72]">
            {tr("Ota-ona kabineti ochildi. Login va parolni ota-onaga bering — parol qayta ko'rsatilmaydi.")}
          </p>
        </div>
        <div className="space-y-2.5">
          <CredentialRow label={tr("Login")} value={createdCredentials.login} />
          <CredentialRow label={tr("Parol")} value={createdCredentials.password} />
        </div>
      </IosSheet>
    );
  }

  return (
    <IosSheet
      open={open}
      onClose={handleClose}
      title={tr("Yangi bola")}
      action={{ label: "Qo'shish", onClick: () => void submit(), ready: isValid, loading: saving }}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={saving} dim={!isValid}>
          {tr("Bolani qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="space-y-6">
        {serverError && (
          <p role="alert" className="rounded-[18px] bg-[#ff3b30]/[0.1] px-4 py-3 text-[14px] text-[#ff3b30]">
            {tr(serverError)}
          </p>
        )}

        {/* Surat */}
        <div className="flex flex-col items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoChecking}
            aria-label={tr("Bola suratini tanlash")}
            className="relative rounded-full transition-transform active:scale-[0.96]"
          >
            {photoImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL, Next optimizatsiyasi kerak emas
              <img src={photoImage} alt={tr("Bola surati")} width={84} height={84} className="h-[84px] w-[84px] rounded-full object-cover" />
            ) : (
              <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[var(--color-primary)]/12 text-[30px] font-semibold text-[var(--color-primary)]">
                {initials(`${firstName ?? ""} ${lastName ?? ""}`) || <CameraIcon className="h-8 w-8" />}
              </span>
            )}
            {photoChecking && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white">
                <Spinner className="h-6 w-6" />
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={photoChecking}
            className="rounded-full px-3 py-1 text-[15px] text-[var(--color-primary)] transition-opacity active:opacity-50 disabled:opacity-50"
          >
            {photoChecking ? tr("Tekshirilmoqda...") : photoImage ? tr("Rasmni almashtirish") : tr("Surat qo'yish (ixtiyoriy)")}
          </button>
          <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoPick} />
          {photoError && (
            <p role="alert" className="max-w-[320px] text-center text-[12.5px] text-[#ff3b30]">
              {tr(photoError)}
            </p>
          )}
        </div>

        {/* Familiya oldinda: ro'yxatlar va hujjatlar "Familiya Ism" tartibida */}
        <FormSection title={tr("Bola")} footer={tr("Saqlanganda bolaga qisqa ID beriladi (masalan id14732)")}>
          <FieldRow label={tr("Familiya")} htmlFor={`${formId}-ln`} error={err("lastName")}>
            <TextInput id={`${formId}-ln`} placeholder={tr("Umaraliyev")} autoComplete="off" {...register("lastName")} />
          </FieldRow>
          <FieldRow label={tr("Ism")} htmlFor={`${formId}-fn`} error={err("firstName")}>
            <TextInput id={`${formId}-fn`} placeholder={tr("Usmon")} autoComplete="off" {...register("firstName")} />
          </FieldRow>
          <FieldRow label={tr("Jinsi")} error={err("gender")}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Segmented
                  label={tr("Jinsi")}
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "MALE", label: tr("O'g'il bola") },
                    { value: "FEMALE", label: tr("Qiz bola") },
                  ]}
                />
              )}
            />
          </FieldRow>
          <FieldRow label={activeGroups.length > 0 ? tr("Guruh") : tr("Guruh (ixtiyoriy)")} htmlFor={`${formId}-g`} error={err("groupId")}>
            <SelectInput id={`${formId}-g`} {...register("groupId")}>
              <option value="" disabled={activeGroups.length > 0}>
                {activeGroups.length > 0 ? tr("Tanlang") : tr("Tanlanmagan")}
              </option>
              {activeGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {tr(group.name)} ({group._count?.children ?? 0}/{group.capacity})
                </option>
              ))}
            </SelectInput>
          </FieldRow>
          <FieldRow label={tr("Tug'ilgan sana")} error={err("birthDate")}>
            <Controller control={control} name="birthDate" render={({ field }) => <DobPicker value={field.value ?? ""} onChange={field.onChange} />} />
          </FieldRow>
        </FormSection>

        <FormSection title={tr("Aloqa uchun ota-ona")} footer={tr("Xuddi shu raqam bilan yana bola qo'shilsa, ikkalasi bir ota-onaga bog'lanadi")}>
          <FieldRow label={tr("Ism familiya")} htmlFor={`${formId}-gn`} error={err("guardianFullName")}>
            <TextInput id={`${formId}-gn`} placeholder={tr("Umaraliyeva Aziza")} autoComplete="off" {...register("guardianFullName")} />
          </FieldRow>
          <FieldRow label={tr("Kim bo'ladi")} htmlFor={`${formId}-gr`}>
            <SelectInput id={`${formId}-gr`} {...register("guardianRelation")}>
              <option value="MOTHER">{tr("Onasi")}</option>
              <option value="FATHER">{tr("Otasi")}</option>
              <option value="GRANDPARENT">{tr("Buvi/bobo")}</option>
              <option value="OTHER">{tr("Boshqa")}</option>
            </SelectInput>
          </FieldRow>
          <FieldRow label={tr("Telefon")} htmlFor={`${formId}-gp`} error={err("guardianPhone")}>
            <TextInput
              id={`${formId}-gp`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+998 90 123 45 67"
              maxLength={13}
              className="tabular-nums"
              {...register("guardianPhone")}
            />
          </FieldRow>
        </FormSection>

        <FormSection title={tr("Ota-ona kabineti paroli")} footer={tr("Bo'sh qoldirilsa avtomatik beriladi va saqlangach ko'rsatiladi")}>
          <FieldRow label={tr("Parol")} htmlFor={`${formId}-pw`} error={err("guardianPassword")}>
            <PasswordInput id={`${formId}-pw`} placeholder={tr("Ixtiyoriy")} autoComplete="new-password" {...register("guardianPassword")} />
          </FieldRow>
          <FieldRow label={tr("Tasdiqlash")} htmlFor={`${formId}-pw2`} error={err("guardianConfirmPassword")}>
            <PasswordInput id={`${formId}-pw2`} placeholder={tr("Qayta kiriting")} autoComplete="new-password" {...register("guardianConfirmPassword")} />
          </FieldRow>
          {password && (
            <div className="px-4 py-3">
              <PasswordChecklist rules={passwordRules} />
            </div>
          )}
        </FormSection>

        <FormSection title={tr("To'lov")} footer={tr("Joriy oy uchun to'lov summasi va muddatini kiriting.")}>
          <FieldRow label={<span className="block leading-snug">{tr("Birinchi hisob-faktura")}</span>} htmlFor={`${formId}-inv`}>
            <div className="flex justify-end">
              <Controller
                control={control}
                name="createInvoice"
                render={({ field }) => <IosSwitch id={`${formId}-inv`} label={tr("Birinchi hisob-fakturani yaratish")} checked={!!field.value} onChange={field.onChange} />}
              />
            </div>
          </FieldRow>
          {createInvoice && (
            <>
              <FieldRow label={tr("Summa")} htmlFor={`${formId}-amt`} error={err("invoiceAmount")}>
                <Controller
                  control={control}
                  name="invoiceAmount"
                  render={({ field }) => (
                    <MoneyInput id={`${formId}-amt`} name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="850 000" />
                  )}
                />
              </FieldRow>
              <FieldRow label={tr("Muddat")} htmlFor={`${formId}-due`} error={err("invoiceDueDate")}>
                <TextInput id={`${formId}-due`} type="date" className="text-right" {...register("invoiceDueDate")} />
              </FieldRow>
            </>
          )}
        </FormSection>
      </form>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </IosSheet>
  );
}
