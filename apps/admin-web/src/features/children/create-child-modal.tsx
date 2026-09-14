"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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

const schema = z
  .object({
    groupId: z.string().optional(),
    lastName: z.string().min(2, "Familiya kamida 2 belgi"),
    firstName: z.string().min(2, "Ism kamida 2 belgi"),
    gender: z.enum(["MALE", "FEMALE"], { message: "Jinsini tanlang" }),
    birthDate: z.string().optional(),
    guardianFullName: z.string().min(2, "Ota-ona ismi kamida 2 belgi"),
    guardianRelation: z.enum(["MOTHER", "FATHER", "GRANDPARENT", "OTHER"]),
    guardianPhone: z
      .string()
      .refine((v) => v.replace(/\D/g, "").length >= 9, "Telefon raqami to'liq emas"),
    // Ixtiyoriy — bo'sh qoldirilsa backend avtomatik generatsiya qiladi
    guardianPassword: z.string().optional(),
    guardianConfirmPassword: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.guardianPassword) return;
    const unmet = getPasswordRules(values.guardianPassword).some((rule) => !rule.met);
    if (unmet) {
      ctx.addIssue({ code: "custom", path: ["guardianPassword"], message: "Parol talablarga javob bermaydi" });
    }
    if (values.guardianPassword !== values.guardianConfirmPassword) {
      ctx.addIssue({ code: "custom", path: ["guardianConfirmPassword"], message: "Parollar mos kelmadi" });
    }
  });

type FormValues = z.infer<typeof schema>;

export function CreateChildModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoImage, setPhotoImage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoChecking, setPhotoChecking] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [createdCredentials, setCreatedCredentials] = useState<ChildCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { guardianRelation: "MOTHER", birthDate: "" },
  });

  const lastName = watch("lastName");
  const firstName = watch("firstName");
  const password = watch("guardianPassword");
  const confirmPassword = watch("guardianConfirmPassword");
  const passwordRules = getPasswordRules(password ?? "", confirmPassword ?? "");

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });

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
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
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
      <Modal open={open} onClose={handleClose} title="Bola qo'shildi">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
              <CheckIcon className="h-6 w-6" />
            </span>
            <p className="text-sm text-[var(--color-text-muted)]">
              Ota-ona kabineti ochildi. Login va parolni ota-onaga bering — parol qayta ko&apos;rsatilmaydi.
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
    <Modal open={open} onClose={handleClose} title="Yangi bola">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
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
                alt="Bola surati"
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
              aria-label="Bola suratini tanlash"
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
            {photoChecking ? "Tekshirilmoqda..." : photoImage ? "Rasmni almashtirish" : "Surat qo'yish (ixtiyoriy)"}
          </button>
          {photoError && (
            <p role="alert" className="max-w-[320px] text-center text-[12.5px] text-[var(--color-danger)]">
              {photoError}
            </p>
          )}
        </div>

        {/* Familiya oldinda: ro'yxatlar va hujjatlar "Familiya Ism" tartibida */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Familiya"
            placeholder="Umaraliyev"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
          <Input label="Ism" placeholder="Usmon" error={errors.firstName?.message} {...register("firstName")} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Jinsi" defaultValue="" error={errors.gender?.message} {...register("gender")}>
            <option value="" disabled>
              Tanlang
            </option>
            <option value="MALE">O&apos;g&apos;il bola</option>
            <option value="FEMALE">Qiz bola</option>
          </Select>
          <Select label="Guruh (ixtiyoriy)" defaultValue="" {...register("groupId")}>
            <option value="">Tanlanmagan</option>
            {groups?.filter((group) => group.status === "ACTIVE").map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group._count?.children ?? 0}/{group.capacity})
              </option>
            ))}
          </Select>
        </div>

        <Input
          label="Tug'ilgan sana (ixtiyoriy)"
          type="date"
          error={errors.birthDate?.message}
          hint="Saqlanganda bolaga qisqa ID beriladi (masalan id14732)"
          {...register("birthDate")}
        />

        <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
          <p className="text-sm font-medium text-[var(--color-text)]">Aloqa uchun ota-ona</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
            <Input
              label="Ismi va familiyasi"
              placeholder="Umaraliyeva Aziza"
              error={errors.guardianFullName?.message}
              {...register("guardianFullName")}
            />
            <Select label="Kim bo'ladi" {...register("guardianRelation")}>
              <option value="MOTHER">Onasi</option>
              <option value="FATHER">Otasi</option>
              <option value="GRANDPARENT">Buvi/bobo</option>
              <option value="OTHER">Boshqa</option>
            </Select>
          </div>
          <Input
            label="Telefon raqami"
            type="tel"
            placeholder="+998 90 123 45 67"
            hint="Xuddi shu raqam bilan yana bola qo'shilsa, ikkalasi bir ota-onaga bog'lanadi"
            error={errors.guardianPhone?.message}
            {...register("guardianPhone")}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <Input
                label="Parol (ixtiyoriy)"
                type={showPassword ? "text" : "password"}
                placeholder="Bo'sh qoldirilsa avtomatik beriladi"
                error={errors.guardianPassword?.message}
                {...register("guardianPassword")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-[38px] cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
              >
                {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Input
                label="Parolni tasdiqlang"
                type={showConfirmPassword ? "text" : "password"}
                error={errors.guardianConfirmPassword?.message}
                {...register("guardianConfirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-[38px] cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
                aria-label={showConfirmPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
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

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Yaratish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
