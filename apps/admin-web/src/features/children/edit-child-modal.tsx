"use client";

import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Child, Group } from "@/lib/types";
import { Toast, type ToastState } from "@/components/ui/toast";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { DobPicker, FieldRow, FormSection, Segmented, SelectInput, TextInput } from "@/components/ios/form";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  groupId: z.string().optional(),
  lastName: z.string().min(2, "Familiya kamida 2 belgi"),
  firstName: z.string().min(2, "Ism kamida 2 belgi"),
  gender: z.enum(["MALE", "FEMALE"], { message: "Jinsini tanlang" }),
  birthDate: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type FormValues = z.infer<typeof schema>;

const FIELD_ORDER: (keyof FormValues)[] = ["lastName", "firstName", "gender", "groupId", "birthDate", "status"];

/**
 * Bolani tahrirlash — iOS varag'ida. "Saqlash" faqat biror narsa
 * o'zgarganda faol; saqlangach varaq yopiladi va ro'yxat o'zi yangilanadi.
 */
export function EditChildModal({
  open,
  onClose,
  slug,
  child,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  child: Child;
  /** Saqlangandan keyin (masalan, toast ko'rsatish uchun) */
  onSaved?: () => void;
}) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const quarantined = child.status === "QUARANTINED";

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: child.firstName,
      lastName: child.lastName,
      gender: child.gender ?? "MALE",
      birthDate: child.birthDate ? child.birthDate.slice(0, 10) : "",
      groupId: child.groupId ?? "",
      status: child.status === "QUARANTINED" ? "ACTIVE" : child.status,
    },
  });

  const mutation = useMutation({
    // Karantindagi bola uchun "Holati" tanlagichi ekranda o'chirilgan bo'lsa
    // ham, forma hali "ACTIVE" qiymatini saqlab turadi — shuni yuborsak,
    // backend butun so'rovni rad etadi (karantinni avval yopish kerak).
    // Shuning uchun bunday holatda `status` maydonini umuman yubormaymiz,
    // qolgan maydonlar (ism, guruh va h.k.) baribir saqlanadi.
    mutationFn: (values: FormValues) =>
      api.patch<Child>(`/app/children/${child.id}`, {
        ...values,
        status: quarantined ? undefined : values.status,
        groupId: values.groupId || null,
        birthDate: values.birthDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child", slug, child.id] });
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const saving = isSubmitting || mutation.isPending;
  const onInvalid = (formErrors: FieldErrors<FormValues>) => {
    const first = FIELD_ORDER.find((key) => formErrors[key]);
    setToast({ type: "error", message: tr((first && formErrors[first]?.message) || "Majburiy maydonlarni to'ldiring") });
    (document.activeElement as HTMLElement | null)?.blur?.();
  };
  const submit = handleSubmit((values) => {
    if (!isDirty) return;
    setServerError(null);
    mutation.mutate(values);
  }, onInvalid);
  const err = (key: keyof FormValues) => errors[key]?.message as string | undefined;

  return (
    <IosSheet
      open={open}
      onClose={() => !saving && onClose()}
      title={tr("Bolani tahrirlash")}
      action={{ label: "Saqlash", onClick: () => void submit(), ready: isDirty, loading: saving }}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={saving} dim={!isDirty}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="space-y-6">
        {serverError && (
          <p role="alert" className="rounded-[18px] bg-[#ff3b30]/[0.1] px-4 py-3 text-[14px] text-[#ff3b30]">
            {tr(serverError)}
          </p>
        )}

        <FormSection title={tr("Bola")}>
          <FieldRow label={tr("Familiya")} htmlFor={`${formId}-ln`} error={err("lastName")}>
            <TextInput id={`${formId}-ln`} autoComplete="off" {...register("lastName")} />
          </FieldRow>
          <FieldRow label={tr("Ism")} htmlFor={`${formId}-fn`} error={err("firstName")}>
            <TextInput id={`${formId}-fn`} autoComplete="off" {...register("firstName")} />
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
          <FieldRow label={tr("Tug'ilgan sana")} error={err("birthDate")}>
            <Controller control={control} name="birthDate" render={({ field }) => <DobPicker value={field.value ?? ""} onChange={field.onChange} />} />
          </FieldRow>
        </FormSection>

        <FormSection
          title={tr("Bog'chada")}
          footer={quarantined ? tr("Karantindagi bolaning holatini avval karantinni yopib o'zgartiring") : undefined}
        >
          <FieldRow label={tr("Guruh")} htmlFor={`${formId}-g`}>
            <SelectInput id={`${formId}-g`} {...register("groupId")}>
              <option value="">{tr("Guruhsiz")}</option>
              {/* Bolaning joriy guruhi nofaol bo'lsa ham ro'yxatda ko'rinib
                  tursin — aks holda tanlov shu guruh emasdek ko'rinardi.
                  Boshqa nofaol guruhga o'tkazib bo'lmaydi. */}
              {groups
                ?.filter((group) => group.status === "ACTIVE" || group.id === child.groupId)
                .map((group) => (
                  <option key={group.id} value={group.id}>
                    {tr(group.name)}
                  </option>
                ))}
            </SelectInput>
          </FieldRow>
          <FieldRow label={tr("Holati")} error={err("status")}>
            {quarantined ? (
              <p className="py-3 text-right text-[15px] font-medium text-[#ff3b30]">{tr("Karantinda")}</p>
            ) : (
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Segmented
                    label={tr("Holati")}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "ACTIVE", label: tr("Faol") },
                      { value: "INACTIVE", label: tr("Nofaol") },
                    ]}
                  />
                )}
              />
            )}
          </FieldRow>
        </FormSection>
      </form>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </IosSheet>
  );
}
