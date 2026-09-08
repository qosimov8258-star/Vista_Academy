"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ChildGuardian } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  relation: z.enum(["FATHER", "MOTHER", "GRANDPARENT", "OTHER"]),
  isPrimary: z.boolean(),
  canPickup: z.boolean(),
  canViewFinance: z.boolean(),
  canReceiveNotifications: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function EditGuardianLinkModal({
  open,
  onClose,
  slug,
  childId,
  link,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
  link: ChildGuardian;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      relation: link.relation,
      isPrimary: link.isPrimary,
      canPickup: link.canPickup,
      canViewFinance: link.canViewFinance,
      canReceiveNotifications: link.canReceiveNotifications,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch(`/app/child-guardians/${link.id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Ota-ona ma'lumotini tahrirlash — ${link.guardian.fullName}`}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label="Qarindoshlik turi" {...register("relation")}>
          <option value="FATHER">Ota</option>
          <option value="MOTHER">Ona</option>
          <option value="GRANDPARENT">Bobo/Buvi</option>
          <option value="OTHER">Boshqa</option>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="h-4 w-4 rounded border-[var(--color-border)]" {...register("isPrimary")} />
            Asosiy vasiy
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="h-4 w-4 rounded border-[var(--color-border)]" {...register("canPickup")} />
            Bolani olib ketishi mumkin
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="h-4 w-4 rounded border-[var(--color-border)]" {...register("canViewFinance")} />
            Moliyani ko'ra oladi
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--color-border)]"
              {...register("canReceiveNotifications")}
            />
            Bildirishnoma oladi
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
