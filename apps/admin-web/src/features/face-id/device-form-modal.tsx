"use client";

import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { FaceIdDevice, FaceIdDeviceStatus } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FieldRow, FormSection, PasswordInput, TextArea, TextInput } from "@/components/ios/form";
import { CheckRow } from "@/components/ios/check-row";
import { IOS } from "@/components/ios/tokens";
import { DEVICE_STATUS, TintNote } from "./shared";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  model: z.string().min(2, "Model nomi kamida 2 belgi"),
  serialNumber: z.string().optional(),
  ipAddress: z.string().optional(),
  port: z
    .string()
    .trim()
    .regex(/^\d{1,5}$/, "Port — raqam")
    .refine((v) => Number(v) >= 1 && Number(v) <= 65535, "Port 1–65535 oralig'ida"),
  username: z.string().optional(),
  password: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const STATUSES: FaceIdDeviceStatus[] = ["ACTIVE", "INACTIVE", "MAINTENANCE"];

function defaults(device?: FaceIdDevice | null): FormValues {
  return {
    name: device?.name ?? "",
    model: device?.model ?? "DS-K1T342MX",
    serialNumber: device?.serialNumber ?? "",
    ipAddress: device?.ipAddress ?? "",
    port: String(device?.port ?? 80),
    username: device?.username ?? "admin",
    password: "",
    location: device?.location ?? "",
    notes: device?.notes ?? "",
  };
}

/** Yangi qurilma qo'shish yoki mavjudini tahrirlash (iOS varag'i) — `device` berilsa tahrirlash rejimi. */
export function DeviceFormModal({
  open,
  onClose,
  slug,
  device,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  device?: FaceIdDevice | null;
  /** Yangi qurilma yaratilganda — agent tokeni faqat shu bir marta keladi */
  onCreated?: (device: FaceIdDevice, agentToken: string) => void;
}) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [status, setStatus] = useState<FaceIdDeviceStatus>(device?.status ?? "ACTIVE");
  const isEditing = !!device;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(device) });

  useEffect(() => {
    if (!open) return;
    reset(defaults(device));
    setStatus(device?.status ?? "ACTIVE");
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat oyna ochilganda yoki tahrirlanayotgan qurilma almashganda to'ldiriladi
  }, [open, device]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        model: values.model,
        serialNumber: values.serialNumber?.trim() || undefined,
        ipAddress: values.ipAddress?.trim() || undefined,
        port: Number(values.port),
        username: values.username?.trim() || undefined,
        // Tahrirlashda bo'sh parol — o'zgarmaydi (yuborilmaydi)
        password: values.password ? values.password : undefined,
        location: values.location?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
        ...(isEditing ? { status } : {}),
      };
      if (isEditing) {
        await api.patch<FaceIdDevice>(`/app/face-id/devices/${device!.id}`, payload);
        return null;
      }
      return api.post<{ device: FaceIdDevice; agentToken: string }>("/app/face-id/devices", payload);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["face-id-devices", slug] });
      onClose();
      if (created) onCreated?.(created.device, created.agentToken);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const saving = isSubmitting || mutation.isPending;
  const field = (name: string) => `${formId}-${name}`;

  return (
    <IosSheet
      open={open}
      onClose={() => !saving && onClose()}
      title={isEditing ? tr("Qurilmani tahrirlash") : tr("Yangi qurilma")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={saving}>
          {isEditing ? tr("Saqlash") : tr("Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
        {serverError && <TintNote color={IOS.red}>{tr(serverError)}</TintNote>}

        <FormSection title={tr("Qurilma")} footer={tr("Masalan: Hikvision Turniket Terminal Kontrol DS-K1T342MX")}>
          <FieldRow label={tr("Nomi")} htmlFor={field("name")} error={errors.name?.message}>
            <TextInput id={field("name")} placeholder={tr("Asosiy kirish turniketi")} className="text-right" {...register("name")} />
          </FieldRow>
          <FieldRow label={tr("Rusumi")} htmlFor={field("model")} error={errors.model?.message}>
            <TextInput id={field("model")} placeholder="DS-K1T342MX" className="text-right" {...register("model")} />
          </FieldRow>
          <FieldRow label={tr("Seriya raqami")} htmlFor={field("serial")} error={errors.serialNumber?.message}>
            <TextInput id={field("serial")} placeholder={tr("Ixtiyoriy")} className="text-right" {...register("serialNumber")} />
          </FieldRow>
          <FieldRow label={tr("Joylashuvi")} htmlFor={field("location")} error={errors.location?.message}>
            <TextInput id={field("location")} placeholder={tr("Ixtiyoriy")} className="text-right" {...register("location")} />
          </FieldRow>
        </FormSection>

        <FormSection title={tr("Tarmoq va kirish")} footer={tr("Parol shifrlab saqlanadi va faqat obyektdagi agentga beriladi — hech kimga ko'rsatilmaydi.")}>
          <FieldRow label={tr("IP manzili")} htmlFor={field("ip")} error={errors.ipAddress?.message}>
            <TextInput id={field("ip")} inputMode="decimal" placeholder="192.168.1.50" className="text-right tabular-nums" {...register("ipAddress")} />
          </FieldRow>
          <FieldRow label={tr("Port")} htmlFor={field("port")} error={errors.port?.message}>
            <TextInput id={field("port")} inputMode="numeric" placeholder="80" className="text-right tabular-nums" {...register("port")} />
          </FieldRow>
          <FieldRow label={tr("Login")} htmlFor={field("user")} error={errors.username?.message}>
            <TextInput id={field("user")} autoComplete="off" placeholder="admin" className="text-right" {...register("username")} />
          </FieldRow>
          <FieldRow label={tr("Parol")} htmlFor={field("password")} error={errors.password?.message}>
            <PasswordInput
              id={field("password")}
              autoComplete="new-password"
              placeholder={isEditing && device?.hasPassword ? tr("O'zgarmaydi") : tr("Qurilma paroli")}
              className="text-right"
              {...register("password")}
            />
          </FieldRow>
        </FormSection>

        {isEditing && (
          <FormSection title={tr("Holati")}>
            <div role="radiogroup" aria-label={tr("Holati")}>
              {STATUSES.map((value) => (
                <CheckRow key={value} label={tr(DEVICE_STATUS[value].label)} checked={status === value} onClick={() => setStatus(value)} />
              ))}
            </div>
          </FormSection>
        )}

        <FormSection>
          <FieldRow label={tr("Izoh")} htmlFor={field("notes")} stacked error={errors.notes?.message}>
            <TextArea id={field("notes")} rows={2} placeholder={tr("Ixtiyoriy")} {...register("notes")} />
          </FieldRow>
        </FormSection>
      </form>
    </IosSheet>
  );
}
