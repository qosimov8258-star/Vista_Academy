"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError, getPaginated } from "@/lib/api";
import type { Child, NotificationEventType, NotificationLog } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FormValues = {
  eventType: "CHILD_ABSENT" | "DAILY_REPORT_READY" | "PAYMENT_DUE" | "CUSTOM";
  childId?: string;
  recipientName: string;
  recipientContact?: string;
  message: string;
};

export function CreateNotificationModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const eventTypeOptions: { value: NotificationEventType; label: string }[] = [
    { value: "CUSTOM", label: t("eventType.custom") },
    { value: "CHILD_ABSENT", label: t("eventType.childAbsent") },
    { value: "DAILY_REPORT_READY", label: t("eventType.dailyReportReady") },
    { value: "PAYMENT_DUE", label: t("eventType.paymentDue") },
  ];

  const schema = z.object({
    eventType: z.enum(["CHILD_ABSENT", "DAILY_REPORT_READY", "PAYMENT_DUE", "CUSTOM"]),
    childId: z.string().optional(),
    recipientName: z.string().min(2, t("validation.recipientNameMin")),
    recipientContact: z.string().optional(),
    message: z.string().min(2, t("validation.messageMin")),
  });

  const childrenQuery = useQuery({
    queryKey: ["children-for-notification", slug],
    queryFn: () => getPaginated<Child>("/app/children?limit=200"),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { eventType: "CUSTOM" },
  });

  const handleChildSelect = (childId: string) => {
    setValue("childId", childId || undefined);
    const child = childrenQuery.data?.data.find((c) => c.id === childId);
    const primaryGuardian = child?.guardians?.[0]?.guardian;
    if (primaryGuardian) {
      setValue("recipientName", primaryGuardian.fullName);
      setValue("recipientContact", primaryGuardian.phone);
    }
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.post<NotificationLog>("/app/notifications", values),
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

  return (
    <Modal open={open} onClose={handleClose} title={t("createTitle")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="font-heading text-center text-[28px] font-extrabold tracking-tight text-[var(--color-primary)]">
          Vista Academy
        </h1>

        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label={t("eventTypeLabel")} error={errors.eventType?.message} {...register("eventType")}>
          {eventTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Select
          label={t("childLabelOptional")}
          defaultValue=""
          onChange={(e) => handleChildSelect(e.target.value)}
        >
          <option value="">{t("notSelected")}</option>
          {childrenQuery.data?.data.map((child) => (
            <option key={child.id} value={child.id}>
              {child.fullName}
            </option>
          ))}
        </Select>
        <Input
          label={t("recipientLabel")}
          placeholder={t("recipientPlaceholder")}
          error={errors.recipientName?.message}
          {...register("recipientName")}
        />
        <Input
          label={t("contactLabel")}
          placeholder="+998901234567"
          error={errors.recipientContact?.message}
          {...register("recipientContact")}
        />
        <Textarea
          label={t("messageLabel")}
          placeholder={t("messagePlaceholder")}
          rows={4}
          error={errors.message?.message}
          {...register("message")}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {t("create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
