"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Lead, TenantUser } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  assignedToUserId: z.string().min(1, "Xodimni tanlang"),
});

type FormValues = z.infer<typeof schema>;

export function AssignLeadModal({
  open,
  onClose,
  slug,
  leadId,
  currentAssignedToUserId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  leadId: string;
  currentAssignedToUserId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users", slug],
    queryFn: () => api.get<TenantUser[]>("/app/users"),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: { assignedToUserId: currentAssignedToUserId ?? "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch<Lead>(`/app/leads/${leadId}/assign`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Mas'ulni belgilash" widthClassName="max-w-md">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label="Mas'ul xodim" defaultValue="" error={errors.assignedToUserId?.message} {...register("assignedToUserId")}>
          <option value="" disabled>
            Tanlang
          </option>
          {usersQuery.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </Select>

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
