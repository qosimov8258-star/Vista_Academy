"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Branch, TenantAuthenticatedUser, TenantUser } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  branchId: z.string().min(1, "Filialni tanlang").optional(),
  fullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
  email: z.string().email("Email formati noto'g'ri"),
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
  const targetRoleLabel = isNetworkAdmin ? "Filial menejeri" : "Administrator";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { branchId: branches[0]?.id ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<TenantUser>("/app/users", {
        ...values,
        branchId: values.branchId || currentUser.branchId,
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
          <Select label="Filial" error={errors.branchId?.message} {...register("branchId")}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        )}
        <Input label="To'liq ism" placeholder="Aziz Rahimov" error={errors.fullName?.message} {...register("fullName")} />
        <Input
          label="Login email"
          type="email"
          placeholder={isNetworkAdmin ? "menejer@tarmoq.uz" : "administrator@tarmoq.uz"}
          error={errors.email?.message}
          {...register("email")}
        />
        <Input label="Parol" type="password" placeholder="Kamida 8 belgi" error={errors.password?.message} {...register("password")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
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
