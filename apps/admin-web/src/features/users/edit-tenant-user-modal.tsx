"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { TenantAuthenticatedUser, TenantUser } from "@/lib/types";
import { ROLE_LABEL, canChangeUserRole } from "@/lib/permissions";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FormValues = {
  fullName: string;
  role?: "BRANCH_ADMIN" | "FINANCE";
  password?: string;
};

export function EditTenantUserModal({
  open,
  onClose,
  slug,
  currentUser,
  user,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  currentUser: TenantAuthenticatedUser;
  user: TenantUser | null;
}) {
  const t = useTranslations("users");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const roleEditable = !!user && canChangeUserRole(currentUser, user);

  const schema = z.object({
    fullName: z.string().min(2, t("validation.fullNameMin")),
    role: z.enum(["BRANCH_ADMIN", "FINANCE"]).optional(),
    // Bo'sh qoldirilsa parol o'zgarmaydi
    password: z.union([z.string().min(8, t("validation.passwordMin")), z.literal("")]).optional(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Boshqa qator uchun oyna qayta ochilganda maydonlar yangilanishi kerak
  useEffect(() => {
    if (!open || !user) return;
    reset({
      fullName: user.fullName,
      role: user.role === "FINANCE" ? "FINANCE" : "BRANCH_ADMIN",
      password: "",
    });
    setServerError(null);
  }, [open, user, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.patch<TenantUser>(`/app/users/${user!.id}`, {
        fullName: values.fullName,
        ...(roleEditable && values.role ? { role: values.role } : {}),
        ...(values.password ? { password: values.password } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-users", slug] });
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title={t("editEmployeeTitle")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
          <p className="text-[13px] text-[var(--color-text-muted)]">{t("loginLabel")}</p>
          <p className="text-[15px] font-medium text-[var(--color-text)]">{user.login}</p>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">{t("loginImmutableHint")}</p>
        </div>

        <Input label={t("fullNameLabel")} error={errors.fullName?.message} {...register("fullName")} />

        {roleEditable ? (
          <Select label={t("roleLabel")} error={errors.role?.message} {...register("role")}>
            <option value="BRANCH_ADMIN">{ROLE_LABEL.BRANCH_ADMIN}</option>
            <option value="FINANCE">{ROLE_LABEL.FINANCE}</option>
          </Select>
        ) : (
          <div>
            <p className="mb-2 text-[13px] font-medium text-[var(--color-text)]">{t("roleLabel")}</p>
            <p className="text-[15px] text-[var(--color-text-muted)]">
              {ROLE_LABEL[user.role]}
              {user.role === "TEACHER" && ` — ${t("teacherRoleHint")}`}
            </p>
          </div>
        )}

        <Input
          label={t("newPasswordLabel")}
          type="password"
          placeholder={t("newPasswordPlaceholder")}
          hint={t("newPasswordHint")}
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex justify-end gap-2 pt-1">
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
