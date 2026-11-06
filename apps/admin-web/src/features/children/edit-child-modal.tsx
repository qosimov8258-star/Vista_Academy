"use client";

import { Controller, useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import type { Child, Group } from "@/lib/types";
import { Toast, type ToastState } from "@/components/ui/toast";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { DobPicker, FieldRow, FormSection, MoneyInput, Segmented, TextInput } from "@/components/ios/form";
import { ChildGroupPicker } from "@/features/children/create-child-modal";
import { useTr } from "@/i18n/tr";
import { GroupFullPrompt } from "./group-full-prompt";
import { useFeatureEnabled } from "@/lib/use-auth";

const schema = z.object({
  groupId: z.string().optional(),
  lastName: z.string().trim().min(2, "Familiya kamida 2 belgi"),
  firstName: z.string().trim().min(2, "Ism kamida 2 belgi"),
  gender: z.enum(["MALE", "FEMALE"], { message: "Jinsini tanlang" }),
  birthDate: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type FormValues = z.infer<typeof schema>;

const FIELD_ORDER: (keyof FormValues)[] = ["lastName", "firstName", "gender", "groupId", "birthDate", "status"];

/** GET /app/children/:id/monthly-fee */
interface ChildFee {
  ownFee: number | null;
  groupFee: number | null;
  period: string;
  invoice: { period: string; amount: number; discountAmount: number; paidAmount: number; status: string } | null;
}

/** PUT /app/children/:id/monthly-fee */
interface ChildFeeResult {
  ownFee: number | null;
  fee: number | null;
  changed: { period: string; from: number; to: number }[];
  skipped: { period: string; paid: number }[];
}

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const monthName = (period: string) => MONTHS[Number(period.slice(5, 7)) - 1] ?? period;
const sum = (value: number) => Math.round(value).toLocaleString("ru-RU").replace(/\u00a0/g, " ");

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
  /** Saqlangandan keyin (masalan, toast ko'rsatish uchun); oylik narx o'zgarsa — nima o'zgargani */
  onSaved?: (message?: string) => void;
}) {
  const tr = useTr();
  const featureOn = useFeatureEnabled();
  const showGender = featureOn("childFieldGender");
  const showBirthDate = featureOn("childFieldBirthDate");
  const formId = useId();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [groupFull, setGroupFull] = useState<string | null>(null);
  const allowOverCapacity = useRef(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const quarantined = child.status === "QUARANTINED";

  // Oylik narx: shu oy hisob-fakturasi bo'lsa — uning summasi (bola hozir shuni to'laydi),
  // bo'lmasa bolaning o'z narxi yoki guruh narxi. O'zgartirilsa shu oydan amal qiladi.
  const feeQuery = useQuery({
    queryKey: ["child-fee", slug, child.id],
    queryFn: () => api.get<ChildFee>(`/app/children/${child.id}/monthly-fee`),
    enabled: open,
  });
  const feeInfo = feeQuery.data;
  const initialFee = feeInfo ? String(Math.round(feeInfo.invoice?.amount ?? feeInfo.ownFee ?? feeInfo.groupFee ?? 0) || "") : "";
  const [fee, setFee] = useState("");
  useEffect(() => {
    if (feeInfo) setFee(initialFee);
  }, [feeInfo, initialFee]);
  const feeDirty = !!feeInfo && fee !== initialFee;
  const [feeNotice, setFeeNotice] = useState<string | null>(null);

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });
  // Bolaning joriy guruhi nofaol bo'lsa ham ro'yxatda ko'rinib tursin — aks
  // holda tanlov shu guruh emasdek ko'rinardi. Boshqa nofaol guruhga o'tkazib bo'lmaydi.
  const groupOptions = useMemo(
    () => groups?.filter((group) => group.status === "ACTIVE" || group.id === child.groupId) ?? [],
    [groups, child.groupId],
  );
  const inactiveIds = useMemo(() => groupOptions.filter((group) => group.status !== "ACTIVE").map((group) => group.id), [groupOptions]);

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

  const saveFee = async (): Promise<ChildFeeResult> =>
    api.put<ChildFeeResult>(`/app/children/${child.id}/monthly-fee`, { amount: fee ? Number(fee) : null });

  const mutation = useMutation({
    // Karantindagi bola uchun "Holati" tanlagichi ekranda o'chirilgan bo'lsa
    // ham, forma hali "ACTIVE" qiymatini saqlab turadi — shuni yuborsak,
    // backend butun so'rovni rad etadi (karantinni avval yopish kerak).
    // Shuning uchun bunday holatda `status` maydonini umuman yubormaymiz,
    // qolgan maydonlar (ism, guruh va h.k.) baribir saqlanadi.
    mutationFn: async (values: FormValues) => {
      if (isDirty) {
        await api.patch<Child>(`/app/children/${child.id}`, {
          ...values,
          // Platforma o'chirgan maydonlar yuborilmaydi (o'zgarmagan bo'lsa ham API rad etadi)
          gender: showGender ? values.gender : undefined,
          birthDate: showBirthDate ? values.birthDate || undefined : undefined,
          status: quarantined ? undefined : values.status,
          groupId: values.groupId || null,
          allowOverCapacity: allowOverCapacity.current || undefined,
        });
      }
      return feeDirty ? saveFee() : null;
    },
    onSuccess: (feeResult) => {
      queryClient.invalidateQueries({ queryKey: ["child", slug, child.id] });
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      if (!feeResult) {
        onSaved?.();
        onClose();
        return;
      }
      // Narx hisob-fakturalar, qarz va kassa ko'rinishlariga ta'sir qiladi
      queryClient.invalidateQueries();
      const changed = feeResult.changed.map((c) => `${tr(monthName(c.period))}: ${sum(c.from)} → ${sum(c.to)}`);
      const message = changed.length
        ? `${tr("Oylik narx saqlandi")}. ${tr("Hisob-faktura")} — ${changed.join(", ")}`
        : tr("Oylik narx saqlandi");
      if (feeResult.skipped.length) {
        // Ko'p to'langan oy o'zgarmadi — foydalanuvchi buni ko'rishi kerak, varaq yopilmaydi
        const skipped = feeResult.skipped.map((s) => `${tr(monthName(s.period))} (${tr("to'langan")} ${sum(s.paid)} so'm)`).join(", ");
        setFeeNotice(`${message}. ${tr("Yangi narxdan ko'p to'langani uchun o'zgarmadi")}: ${skipped}`);
        return;
      }
      onSaved?.(message);
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "GROUP_FULL") {
        setGroupFull(err.message);
        return;
      }
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
    onSettled: () => {
      allowOverCapacity.current = false;
    },
  });

  const saving = isSubmitting || mutation.isPending;
  const onInvalid = (formErrors: FieldErrors<FormValues>) => {
    const first = FIELD_ORDER.find((key) => formErrors[key]);
    setToast({ type: "error", message: tr((first && formErrors[first]?.message) || "Majburiy maydonlarni to'ldiring") });
    (document.activeElement as HTMLElement | null)?.blur?.();
  };
  const ready = isDirty || feeDirty;
  const submit = handleSubmit((values) => {
    if (!ready) return;
    setServerError(null);
    setFeeNotice(null);
    setGroupFull(null);
    mutation.mutate(values);
  }, onInvalid);
  const err = (key: keyof FormValues) => errors[key]?.message as string | undefined;

  function feeFooter() {
    if (!feeInfo) return undefined;
    const lines: string[] = [];
    const invoice = feeInfo.invoice;
    if (invoice) {
      const paid = invoice.paidAmount > 0 ? `, ${tr("to'langan")} ${sum(invoice.paidAmount)} so'm` : "";
      const month = tr(monthName(invoice.period));
      lines.push(`${month.charAt(0).toUpperCase()}${month.slice(1)} ${tr("hisob-fakturasi")}: ${sum(invoice.amount)} so'm${paid}.`);
      if (feeInfo.ownFee !== null && Math.abs(feeInfo.ownFee - invoice.amount) >= 1) {
        lines.push(`${tr("Keyingi oylar narxi")}: ${sum(feeInfo.ownFee)} so'm.`);
      }
    }
    lines.push(
      feeDirty
        ? tr("Shu oydan boshlab amal qiladi: shu oy va keyingi oylar hisob-fakturasi yangi summaga o'tadi, o'tgan oylar o'zgarmaydi.")
        : tr("O'zgartirsangiz, shu oydan boshlab amal qiladi."),
    );
    lines.push(feeInfo.groupFee ? `${tr("Guruh narxi")}: ${sum(feeInfo.groupFee)} so'm. ${tr("Bo'sh qoldirilsa guruh narxi olinadi.")}` : tr("Guruh narxi belgilanmagan."));
    return lines.join(" ");
  }

  return (
    <IosSheet
      open={open}
      onClose={() => !saving && onClose()}
      title={tr("Bolani tahrirlash")}
      action={{ label: "Saqlash", onClick: () => void submit(), ready, loading: saving }}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={saving} dim={!ready}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="space-y-6">
        {groupFull && (
          <GroupFullPrompt
            message={groupFull}
            confirmLabel="Baribir saqlash"
            loading={saving}
            onCancel={() => setGroupFull(null)}
            onConfirm={() => {
              allowOverCapacity.current = true;
              void submit();
            }}
          />
        )}
        {serverError && (
          <p role="alert" className="rounded-[18px] bg-[#ff3b30]/[0.1] px-4 py-3 text-[14px] text-[#ff3b30]">
            {tr(serverError)}
          </p>
        )}
        {feeNotice && (
          <p role="status" className="rounded-[18px] bg-[#ff9500]/[0.12] px-4 py-3 text-[14px] text-[#c93400]">
            {feeNotice}
          </p>
        )}

        <FormSection title={tr("Bola")}>
          <FieldRow label={tr("Familiya")} htmlFor={`${formId}-ln`} error={err("lastName")}>
            <TextInput id={`${formId}-ln`} autoComplete="off" {...register("lastName")} />
          </FieldRow>
          <FieldRow label={tr("Ism")} htmlFor={`${formId}-fn`} error={err("firstName")}>
            <TextInput id={`${formId}-fn`} autoComplete="off" {...register("firstName")} />
          </FieldRow>
          {showGender && (
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
          )}
          {/* Uch kapsula (kun/oy/yil) telefonda yorliq yoniga sig'maydi — yorliq tepada */}
          {showBirthDate && (
          <FieldRow stacked label={tr("Tug'ilgan sana")} error={err("birthDate")}>
            <Controller control={control} name="birthDate" render={({ field }) => <DobPicker value={field.value ?? ""} onChange={field.onChange} />} />
          </FieldRow>
          )}
        </FormSection>

        <FormSection
          title={tr("Bog'chada")}
          footer={quarantined ? tr("Karantindagi bolaning holatini avval karantinni yopib o'zgartiring") : undefined}
        >
          <FieldRow label={tr("Guruh")} htmlFor={`${formId}-g`} error={err("groupId")}>
            <Controller
              control={control}
              name="groupId"
              render={({ field }) => (
                <ChildGroupPicker
                  id={`${formId}-g`}
                  title={tr("Guruh")}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  groups={groupOptions}
                  inactiveIds={inactiveIds}
                  loading={!groups}
                  placeholder={tr("Guruhsiz")}
                  emptyOption={tr("Guruhsiz")}
                />
              )}
            />
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

        <FormSection title={tr("To'lov")} footer={feeFooter()}>
          <FieldRow label={tr("Oylik to'lov")} htmlFor={`${formId}-fee`}>
            {feeQuery.isError ? (
              <p className="py-3 text-right text-[14px] text-[#8e8e93]">{tr("Yuklab bo'lmadi")}</p>
            ) : (
              <MoneyInput id={`${formId}-fee`} value={fee} onChange={setFee} placeholder={feeInfo ? (feeInfo.groupFee ? sum(feeInfo.groupFee) : "0") : "…"} />
            )}
          </FieldRow>
        </FormSection>
      </form>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </IosSheet>
  );
}
