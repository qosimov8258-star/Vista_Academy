"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Branch, TenantAuthenticatedUser, TenantUser, TenantUserRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/permissions";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/;
const LOGIN_MESSAGE = "Login lotin harf, raqam, . _ - dan iborat bo'lishi va kamida 3 belgi bo'lishi kerak";

const schema = z.object({
  branchId: z.string().min(1, "Filialni tanlang").optional(),
  // Super Admin filial admini yoki moliyachi yaratadi; filial admini uchun bu
  // maydon ko'rinmaydi va server baribir doim MANAGER yaratadi.
  role: z.enum(["BRANCH_ADMIN", "FINANCE"]).optional(),
  fullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
  login: z.string().regex(LOGIN_PATTERN, LOGIN_MESSAGE),
  password: z.string().min(8, "Kamida 8 belgi"),
});

type FormValues = z.infer<typeof schema>;

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
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isNetworkAdmin = currentUser.role === "NETWORK_ADMIN";

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
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
  }, [open, firstBranchId, reset]);

  // Sarlavha va login namunasi tanlangan rolga qarab o'zgaradi
  const selectedRole = watch("role") ?? "BRANCH_ADMIN";
  const targetRole: TenantUserRole = isNetworkAdmin ? selectedRole : "MANAGER";
  const targetRoleLabel = ROLE_LABEL[targetRole];
  const loginPlaceholder =
    targetRole === "FINANCE" ? "moliyachi" : targetRole === "BRANCH_ADMIN" ? "filial_admin" : "administrator";

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<TenantUser>("/app/users", {
        ...values,
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
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Yangi ${targetRoleLabel.toLowerCase()}`}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        {isNetworkAdmin && (
          <>
            <Select label="Filial" error={errors.branchId?.message} {...register("branchId")}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <Select
              label="Rol"
              error={errors.role?.message}
              hint={
                selectedRole === "FINANCE"
                  ? "Moliya va Ish haqi bo'limlarida ishlaydi, qolgan bo'limlarni faqat ko'radi"
                  : "Filialning barcha bo'limlarida to'liq ishlaydi va administrator qo'sha oladi"
              }
              {...register("role")}
            >
              <option value="BRANCH_ADMIN">{ROLE_LABEL.BRANCH_ADMIN}</option>
              <option value="FINANCE">{ROLE_LABEL.FINANCE}</option>
            </Select>
          </>
        )}
        <Input label="To'liq ism" placeholder="Aziz Rahimov" error={errors.fullName?.message} {...register("fullName")} />
        <Input
          label="Login"
          type="text"
          placeholder={loginPlaceholder}
          error={errors.login?.message}
          {...register("login")}
        />
        <Input label="Parol" type="password" placeholder="Kamida 8 belgi" error={errors.password?.message} {...register("password")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Yaratish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
