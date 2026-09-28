"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Branch } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type FormValues = {
  name: string;
  address?: string;
  openTime?: string;
  closeTime?: string;
  defaultTuitionAmount?: number | "";
};

export function EditBranchModal({
  open,
  onClose,
  slug,
  branch,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  branch: Branch;
}) {
  const t = useTranslations("branches");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().min(2, t("validation.nameMin")),
    address: z.string().optional(),
    openTime: z.string().regex(TIME_PATTERN, t("validation.timeFormat")).optional().or(z.literal("")),
    closeTime: z.string().regex(TIME_PATTERN, t("validation.timeFormat")).optional().or(z.literal("")),
    defaultTuitionAmount: z.coerce.number().min(0).optional().or(z.literal("")),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: branch.name,
      address: branch.address ?? "",
      openTime: branch.openTime ?? "",
      closeTime: branch.closeTime ?? "",
      defaultTuitionAmount: branch.defaultTuitionAmount ? Number(branch.defaultTuitionAmount) : "",
    },
  });

  const mutation = useMutation({
    // Bo'sh qoldirilgan maydon `null` bilan yuboriladi — shunda backend uni
    // "tozala" deb tushunadi (`undefined` bo'lsa "o'zgartirma" deb qoladi).
    mutationFn: (values: FormValues) =>
      api.patch<Branch>(`/app/organizations/me/branches/${branch.id}`, {
        name: values.name,
        address: values.address || null,
        openTime: values.openTime || null,
        closeTime: values.closeTime || null,
        defaultTuitionAmount: values.defaultTuitionAmount === "" ? null : values.defaultTuitionAmount,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", slug] });
      queryClient.invalidateQueries({ queryKey: ["branch", slug, branch.id] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("editTitle")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label={t("nameLabel")} error={errors.name?.message} {...register("name")} />
        <Input label={t("addressLabel")} {...register("address")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t("openTimeLabel")} placeholder="08:00" error={errors.openTime?.message} {...register("openTime")} />
          <Input label={t("closeTimeLabel")} placeholder="19:00" error={errors.closeTime?.message} {...register("closeTime")} />
        </div>
        <Input
          label={t("tuitionLabel")}
          type="number"
          min={0}
          placeholder="500000"
          hint={t("tuitionHint")}
          error={errors.defaultTuitionAmount?.message}
          {...register("defaultTuitionAmount")}
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
