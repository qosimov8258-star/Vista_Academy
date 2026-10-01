"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError, getPaginated } from "@/lib/api";
import type { Child, NotificationEventType, NotificationLog } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTr } from "@/i18n/tr";

const eventTypeOptions: { value: NotificationEventType; label: string }[] = [
  { value: "CUSTOM", label: "Boshqa" },
  { value: "CHILD_ABSENT", label: "Bola kelmadi" },
  { value: "DAILY_REPORT_READY", label: "Kundalik hisobot tayyor" },
  { value: "PAYMENT_DUE", label: "To'lov muddati" },
];

const schema = z.object({
  eventType: z.enum(["CHILD_ABSENT", "DAILY_REPORT_READY", "PAYMENT_DUE", "CUSTOM"]),
  childId: z.string().optional(),
  recipientName: z.string().min(2, "Qabul qiluvchi ismi kamida 2 belgi"),
  recipientContact: z.string().optional(),
  message: z.string().min(2, "Xabar matni kamida 2 belgi"),
});

type FormValues = z.infer<typeof schema>;

export function CreateNotificationModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

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
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const handleClose = () => {
    setServerError(null);
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={tr("Yangi bildirishnoma yozuvi")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}
        <Select label={tr("Hodisa turi")} error={errors.eventType?.message} {...register("eventType")}>
          {eventTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {tr(opt.label)}
            </option>
          ))}
        </Select>
        <Select
          label={tr("Bola (ixtiyoriy)")}
          defaultValue=""
          onChange={(e) => handleChildSelect(e.target.value)}
        >
          <option value="">{tr("Tanlanmagan")}</option>
          {childrenQuery.data?.data.map((child) => (
            <option key={child.id} value={child.id}>
              {tr(child.fullName)}
            </option>
          ))}
        </Select>
        <Input
          label={tr("Qabul qiluvchi (ota-ona)")}
          placeholder={tr("Karimova Aziza")}
          error={errors.recipientName?.message}
          {...register("recipientName")}
        />
        <Input
          label={tr("Aloqa (telefon, ixtiyoriy)")}
          placeholder="+998901234567"
          error={errors.recipientContact?.message}
          {...register("recipientContact")}
        />
        <Textarea
          label={tr("Xabar matni")}
          placeholder={tr("Xurmatli ota-ona, ...")}
          rows={4}
          error={errors.message?.message}
          {...register("message")}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {tr("Bekor qilish")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {tr("Yaratish")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
