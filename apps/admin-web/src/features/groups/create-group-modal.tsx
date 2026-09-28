"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Group } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateGroupModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const t = useTranslations("groups");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().min(2, t("validation.nameMin")),
    capacity: z.coerce.number().int().min(1).max(100),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { capacity: 20 },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.post<Group>("/app/groups", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("createTitle")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="font-heading text-center text-[28px] font-extrabold tracking-tight text-[var(--color-primary)]">
          Vista Academy
        </h1>

        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label={t("nameLabel")} placeholder={t("namePlaceholder")} error={errors.name?.message} {...register("name")} />
        <Input label={t("capacityLabel")} type="number" min={1} max={100} error={errors.capacity?.message} {...register("capacity")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
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
