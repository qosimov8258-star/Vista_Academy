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

const LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/;

type FormValues = {
  name: string;
  address?: string;
  managerFullName: string;
  managerLogin: string;
  managerPassword: string;
};

export function CreateBranchModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const t = useTranslations("branches");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().min(2, t("validation.nameMin")),
    address: z.string().optional(),
    managerFullName: z.string().min(2, t("validation.fullNameMin")),
    managerLogin: z.string().regex(LOGIN_PATTERN, t("validation.loginPattern")),
    managerPassword: z.string().min(8, t("validation.passwordMin")),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Branch>("/app/organizations/me/branches", { ...values, address: values.address || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", slug] });
      queryClient.invalidateQueries({ queryKey: ["tenant-users", slug] });
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
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label={t("nameLabel")} placeholder={t("namePlaceholder")} error={errors.name?.message} {...register("name")} />
        <Input label={t("addressLabel")} placeholder={t("addressPlaceholder")} {...register("address")} />

        <div className="border-t border-[var(--color-border)] pt-4">
          <p className="mb-3 text-sm font-medium text-[var(--color-text)]">{t("managerSection")}</p>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">{t("managerSectionHint")}</p>
          <div className="space-y-4">
            <Input
              label={t("managerFullNameLabel")}
              placeholder={t("managerFullNamePlaceholder")}
              error={errors.managerFullName?.message}
              {...register("managerFullName")}
            />
            <Input
              label={t("loginLabel")}
              type="text"
              placeholder={t("loginPlaceholder")}
              error={errors.managerLogin?.message}
              {...register("managerLogin")}
            />
            <Input
              label={t("passwordLabel")}
              type="password"
              placeholder={t("passwordPlaceholder")}
              error={errors.managerPassword?.message}
              {...register("managerPassword")}
            />
          </div>
        </div>

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
