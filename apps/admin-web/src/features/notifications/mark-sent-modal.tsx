"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { NotificationChannel, NotificationLog } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FormValues = {
  channel: "SMS" | "TELEGRAM" | "EMAIL" | "PHONE_CALL" | "IN_APP";
};

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
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const channelOptions: { value: NotificationChannel; label: string }[] = [
    { value: "PHONE_CALL", label: t("channel.phoneCall") },
    { value: "SMS", label: t("channel.sms") },
    { value: "TELEGRAM", label: t("channel.telegram") },
    { value: "EMAIL", label: t("channel.email") },
    { value: "IN_APP", label: t("channel.inApp") },
  ];

  const schema = z.object({
    channel: z.enum(["SMS", "TELEGRAM", "EMAIL", "PHONE_CALL", "IN_APP"]),
  });

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
      if (!notification) throw new Error(t("noNotificationSelected"));
      return api.patch<NotificationLog>(`/app/notifications/${notification.id}/mark-sent`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  const handleClose = () => {
    setServerError(null);
    reset();
    onClose();
  };

  if (!notification) return null;

  return (
    <Modal open={open} onClose={handleClose} title={t("markSentTitle")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t("markSentHintBefore")}{" "}
          <span className="font-medium text-[var(--color-text)]">{notification.recipientName}</span>{" "}
          {t("markSentHintAfter")}
        </p>

        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <Select label={t("channelLabel")} error={errors.channel?.message} {...register("channel")}>
          {channelOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {t("confirm")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
