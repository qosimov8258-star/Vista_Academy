"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { FaceIdDevice, FaceIdDeviceStatus } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SelectMenu } from "@/components/ui/select-menu";
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

const STATUS_OPTIONS: { value: FaceIdDeviceStatus; label: string }[] = [
  { value: "ACTIVE", label: "Faol" },
  { value: "INACTIVE", label: "Nofaol" },
  { value: "MAINTENANCE", label: "Texnik xizmatda" },
];

/** Yangi qurilma qo'shish yoki mavjudini tahrirlash — `device` berilsa tahrirlash rejimi. */
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
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [status, setStatus] = useState<FaceIdDeviceStatus>(device?.status ?? "ACTIVE");
  const isEditing = !!device;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: device?.name ?? "",
      model: device?.model ?? "DS-K1T342MX",
      serialNumber: device?.serialNumber ?? "",
      ipAddress: device?.ipAddress ?? "",
      port: String(device?.port ?? 80),
      username: device?.username ?? "admin",
      password: "",
      location: device?.location ?? "",
      notes: device?.notes ?? "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: device?.name ?? "",
      model: device?.model ?? "DS-K1T342MX",
      serialNumber: device?.serialNumber ?? "",
      ipAddress: device?.ipAddress ?? "",
      port: String(device?.port ?? 80),
      username: device?.username ?? "admin",
      password: "",
      location: device?.location ?? "",
      notes: device?.notes ?? "",
    });
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

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Qurilmani tahrirlash" : tr("Yangi qurilma")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}

        <Input
          label={tr("Nomi")}
          placeholder={tr("Asosiy kirish turniketi")}
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          label={tr("Qurilma rusumi")}
          placeholder="DS-K1T342MX"
          hint={tr("Masalan: Hikvision Turniket Terminal Kontrol DS-K1T342MX")}
          error={errors.model?.message}
          {...register("model")}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={tr("Seriya raqami")}
            placeholder={tr("Ixtiyoriy")}
            error={errors.serialNumber?.message}
            {...register("serialNumber")}
          />
          <Input
            label={tr("IP manzili")}
            placeholder={tr("192.168.1.50 (ixtiyoriy)")}
            error={errors.ipAddress?.message}
            {...register("ipAddress")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
          <Input
            label={tr("Qurilma logini")}
            placeholder="admin"
            autoComplete="off"
            error={errors.username?.message}
            {...register("username")}
          />
          <Input label={tr("Port")} inputMode="numeric" placeholder="80" error={errors.port?.message} {...register("port")} />
        </div>
        <Input
          label={tr("Qurilma paroli")}
          type="password"
          autoComplete="new-password"
          placeholder={isEditing && device?.hasPassword ? tr("O'zgartirmaslik uchun bo'sh qoldiring") : "Qurilma administratori paroli"}
          hint={tr("Shifrlab saqlanadi va faqat obyektdagi agentga beriladi — hech kimga ko'rsatilmaydi.")}
          error={errors.password?.message}
          {...register("password")}
        />

        <Input
          label={tr("Joylashuvi")}
          placeholder={tr("Asosiy kirish eshigi (ixtiyoriy)")}
          error={errors.location?.message}
          {...register("location")}
        />

        {isEditing && <SelectMenu label={tr("Holati")} options={STATUS_OPTIONS} value={status} onChange={(v) => setStatus(v as FaceIdDeviceStatus)} />}

        <Textarea label={tr("Izoh")} rows={2} placeholder={tr("Ixtiyoriy")} error={errors.notes?.message} {...register("notes")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr("Bekor qilish")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEditing ? "Saqlash" : tr("Qo'shish")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
