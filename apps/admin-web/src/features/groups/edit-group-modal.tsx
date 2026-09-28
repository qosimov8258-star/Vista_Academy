"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Group } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { SelectMenu } from "@/components/ui/select-menu";
import { Button } from "@/components/ui/button";

export function EditGroupModal({
  open,
  onClose,
  slug,
  group,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  group: Group;
}) {
  const t = useTranslations("groups");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const STATUS_OPTIONS = [
    { value: "ACTIVE", label: t("status.active") },
    { value: "INACTIVE", label: t("status.inactive") },
  ];

  const schema = z.object({
    name: z.string().min(2, t("validation.nameMin")),
    capacity: z.coerce.number().int().min(1).max(100),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: group.name, capacity: group.capacity, status: group.status },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch<Group>(`/app/groups/${group.id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", slug] });
      queryClient.invalidateQueries({ queryKey: ["group", slug, group.id] });
      queryClient.invalidateQueries({ queryKey: ["group-overview", slug, group.id] });
      // Holat (faol/nofaol) o'zgarishi Bosh sahifadagi "Faol guruhlar"
      // ko'rsatkichiga ta'sir qiladi.
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("editTitle")} widthClassName="max-w-md">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label={t("nameLabel")} error={errors.name?.message} {...register("name")} />
        <Input label={t("capacityLabel")} type="number" min={1} max={100} error={errors.capacity?.message} {...register("capacity")} />
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SelectMenu label={t("statusLabel")} options={STATUS_OPTIONS} value={field.value} onChange={field.onChange} error={errors.status?.message} />
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
