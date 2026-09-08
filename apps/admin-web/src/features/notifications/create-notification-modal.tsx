"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { NotificationEventType, NotificationLog } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const eventTypeOptions: { value: NotificationEventType; label: string }[] = [
  { value: "CUSTOM", label: "Boshqa" },
  { value: "CHILD_ABSENT", label: "Bola kelmadi" },
  { value: "DAILY_REPORT_READY", label: "Kundalik hisobot tayyor" },
  { value: "PAYMENT_DUE", label: "To'lov muddati" },
  { value: "PAYMENT_OVERDUE", label: "To'lov kechikdi" },
  { value: "VACCINATION_DUE", label: "Vaksinatsiya muddati" },
  { value: "QUARANTINE_ALERT", label: "Karantin xabari" },
  { value: "LEAD_FOLLOW_UP", label: "Ariza bo'yicha aloqa" },
];

const schema = z.object({
  eventType: z.enum([
    "CHILD_ABSENT",
    "DAILY_REPORT_READY",
    "PAYMENT_DUE",
    "PAYMENT_OVERDUE",
    "VACCINATION_DUE",
    "QUARANTINE_ALERT",
    "LEAD_FOLLOW_UP",
    "CUSTOM",
  ]),
  recipientName: z.string().min(2, "Qabul qiluvchi ismi kamida 2 belgi"),
  recipientContact: z.string().optional(),
  message: z.string().min(2, "Xabar matni kamida 2 belgi"),
});

type FormValues = z.infer<typeof schema>;

export function CreateNotificationModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { eventType: "CUSTOM" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.post<NotificationLog>("/app/notifications", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const handleClose = () => {
    setServerError(null);
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Yangi bildirishnoma yozuvi">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label="Hodisa turi" error={errors.eventType?.message} {...register("eventType")}>
          {eventTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Input
          label="Qabul qiluvchi (ota-ona)"
          placeholder="Karimova Aziza"
          error={errors.recipientName?.message}
          {...register("recipientName")}
        />
        <Input
          label="Aloqa (telefon, ixtiyoriy)"
          placeholder="+998901234567"
          error={errors.recipientContact?.message}
          {...register("recipientContact")}
        />
        <Textarea
          label="Xabar matni"
          placeholder="Xurmatli ota-ona, ..."
          rows={4}
          error={errors.message?.message}
          {...register("message")}
        />

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
