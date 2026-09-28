"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Branch, TenantAuthenticatedUser, TenantUser, TenantUserRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/permissions";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { PasswordChecklist, getPasswordRules } from "@/components/ui/password-checklist";

const LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/;

export function CreateTenantUserModal({
  open,
  onClose,
  slug,
  currentUser,
  branches,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  currentUser: TenantAuthenticatedUser;
  branches: Branch[];
}) {
  const t = useTranslations("users");
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isNetworkAdmin = currentUser.role === "NETWORK_ADMIN";

  const schema = z
    .object({
      branchId: z.string().min(1, t("validation.selectBranch")).optional(),
      // Super Admin filial admini yoki moliyachi yaratadi; filial admini uchun bu
      // maydon ko'rinmaydi va server baribir doim MANAGER yaratadi.
      role: z.enum(["BRANCH_ADMIN", "FINANCE"]).optional(),
      fullName: z.string().min(2, t("validation.fullNameMin")),
      login: z.string().regex(LOGIN_PATTERN, t("validation.loginPattern")),
      password: z.string(),
      confirmPassword: z.string(),
    })
    .superRefine((values, ctx) => {
      const unmet = getPasswordRules(values.password).some((rule) => !rule.met);
      if (unmet) {
        ctx.addIssue({ code: "custom", path: ["password"], message: t("validation.passwordRequirements") });
      }
      if (values.password !== values.confirmPassword) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: t("validation.passwordsMismatch") });
      }
    });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { branchId: "", role: "BRANCH_ADMIN" },
  });

  // Filiallar ro'yxati so'rov bilan keladi va forma yaratilganda hali bo'sh
  // bo'lishi mumkin — o'sha paytdagi defaultValues hech qaysi variantga mos
  // kelmay, "Filial" maydoni bo'sh ko'rinadi va yuborilganda xato beradi.
  // Shuning uchun oyna har ochilganda formani joriy birinchi filial bilan
  // qaytadan sozlaymiz (bu bir vaqtning o'zida oldingi kiritilganlarni ham tozalaydi).
  const firstBranchId = branches[0]?.id ?? "";
  useEffect(() => {
    if (!open) return;
    reset({ branchId: firstBranchId, role: "BRANCH_ADMIN" });
    setServerError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [open, firstBranchId, reset]);

  const password = watch("password");
  const confirmPassword = watch("confirmPassword");
  const passwordRules = getPasswordRules(password ?? "", confirmPassword ?? "");

  // Sarlavha va login namunasi tanlangan rolga qarab o'zgaradi
  const selectedRole = watch("role") ?? "BRANCH_ADMIN";
  const targetRole: TenantUserRole = isNetworkAdmin ? selectedRole : "MANAGER";
  const targetRoleLabel = ROLE_LABEL[targetRole];
  const loginPlaceholder =
    targetRole === "FINANCE"
      ? t("loginPlaceholder.finance")
      : targetRole === "BRANCH_ADMIN"
        ? t("loginPlaceholder.branchAdmin")
        : t("loginPlaceholder.administrator");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<TenantUser>("/app/users", {
        fullName: values.fullName,
        login: values.login,
        password: values.password,
        branchId: values.branchId || currentUser.branchId,
        // Rolni faqat Super Admin tanlaydi; filial admini yuborsa ham server
        // e'tiborga olmaydi, shuning uchun umuman yubormaymiz.
        role: isNetworkAdmin ? values.role : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-users", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : t("unexpectedError"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={t("newRoleTitle", { role: targetRoleLabel.toLowerCase() })}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <h1 className="font-heading text-center text-[28px] font-extrabold tracking-tight text-[var(--color-primary)]">
          Vista Academy
        </h1>

        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        {isNetworkAdmin && (
          <>
            <Select label={t("branchLabel")} error={errors.branchId?.message} {...register("branchId")}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select
              label={t("roleLabel")}
              error={errors.role?.message}
              hint={selectedRole === "FINANCE" ? t("roleHint.finance") : t("roleHint.branchAdmin")}
              {...register("role")}
            >
              <option value="BRANCH_ADMIN">{ROLE_LABEL.BRANCH_ADMIN}</option>
              <option value="FINANCE">{ROLE_LABEL.FINANCE}</option>
            </Select>
          </>
        )}
        <Input label={t("fullNameLabel")} placeholder={t("fullNamePlaceholder")} error={errors.fullName?.message} {...register("fullName")} />
        <Input
          label={t("loginLabel")}
          type="text"
          placeholder={loginPlaceholder}
          error={errors.login?.message}
          {...register("login")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative">
            <Input
              label={t("passwordLabel")}
              type={showPassword ? "text" : "password"}
              error={errors.password?.message}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-[38px] cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            >
              {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              label={t("confirmPasswordLabel")}
              type={showConfirmPassword ? "text" : "password"}
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-[38px] cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
              aria-label={showConfirmPassword ? t("hidePassword") : t("showPassword")}
            >
              {showConfirmPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {password && (
          <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3">
            <PasswordChecklist rules={passwordRules} />
          </div>
        )}

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
