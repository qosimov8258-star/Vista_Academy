"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { NotificationChannel, NotificationLog } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const channelOptions: { value: NotificationChannel; label: string }[] = [
  { value: "PHONE_CALL", label: "Telefon qo'ng'iroq" },
  { value: "SMS", label: "SMS" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "EMAIL", label: "Email" },
  { value: "IN_APP", label: "Ilova ichida" },
];

const schema = z.object({
  channel: z.enum(["SMS", "TELEGRAM", "EMAIL", "PHONE_CALL", "IN_APP"]),
});

type FormValues = z.infer<typeof schema>;

export function MarkSentModal({
  open,
  onClose,
  slug,
  notification,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  notification: NotificationLog | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { channel: "PHONE_CALL" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!notification) throw new Error("Bildirishnoma tanlanmagan");
      return api.patch<NotificationLog>(`/app/notifications/${notification.id}/mark-sent`, values);
    },
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

  if (!notification) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Yuborildi deb belgilash">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <p className="text-sm text-[var(--color-text-muted)]">
          Qabul qiluvchiga <span className="font-medium text-[var(--color-text)]">{notification.recipientName}</span> haqiqatda
          qaysi kanal orqali xabar berdingiz? Tizim haqiqiy SMS/Telegram yubormaydi — bu faqat qayd etish uchun.
        </p>

        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <Select label="Kanal" error={errors.channel?.message} {...register("channel")}>
          {channelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Tasdiqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
