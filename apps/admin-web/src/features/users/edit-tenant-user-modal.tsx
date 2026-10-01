"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { TenantAuthenticatedUser, TenantUser } from "@/lib/types";
import { ROLE_LABEL, canChangeUserRole } from "@/lib/permissions";
import { Modal } from "@/components/ui/modal";
import { Input, PasswordInput, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  fullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
  role: z.enum(["BRANCH_ADMIN", "FINANCE"]).optional(),
  // Bo'sh qoldirilsa parol o'zgarmaydi
  password: z.union([z.string().min(8, "Kamida 8 belgi"), z.literal("")]).optional(),
});

type FormValues = z.infer<typeof schema>;

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
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const roleEditable = !!user && canChangeUserRole(currentUser, user);

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
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title={tr("Xodimni tahrirlash")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}

        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
          <p className="text-[13px] text-[var(--color-text-muted)]">{tr("Login")}</p>
          <p className="text-[15px] font-medium text-[var(--color-text)]">{tr(user.login)}</p>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            {tr("Login o'zgartirilmaydi — u hisobning doimiy identifikatori.")}
          </p>
        </div>

        <Input label={tr("To'liq ism")} error={errors.fullName?.message} {...register("fullName")} />

        {roleEditable ? (
          <Select label={tr("Rol")} error={errors.role?.message} {...register("role")}>
            <option value="BRANCH_ADMIN">{tr(ROLE_LABEL.BRANCH_ADMIN)}</option>
            <option value="FINANCE">{tr(ROLE_LABEL.FINANCE)}</option>
          </Select>
        ) : (
          <div>
            <p className="mb-2 text-[13px] font-medium text-[var(--color-text)]">{tr("Rol")}</p>
            <p className="text-[15px] text-[var(--color-text-muted)]">
              {tr(ROLE_LABEL[user.role])}
              {user.role === "TEACHER" && tr(" — o'qituvchi roli guruh biriktiruviga bog'langan, bu yerdan o'zgartirilmaydi")}
            </p>
          </div>
        )}

        <PasswordInput
          label={tr("Yangi parol")}
          placeholder={tr("Bo'sh qoldirilsa o'zgarmaydi")}
          hint={tr("Parol almashtirilsa, xodimning ochiq seanslari yopiladi")}
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr("Bekor qilish")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {tr("Saqlash")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
