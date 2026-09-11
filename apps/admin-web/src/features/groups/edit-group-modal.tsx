"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Group } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { SelectMenu } from "@/components/ui/select-menu";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Faol" },
  { value: "INACTIVE", label: "Nofaol" },
];

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  capacity: z.coerce.number().int().min(1).max(100),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type FormValues = z.infer<typeof schema>;

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
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

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
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Guruhni tahrirlash" widthClassName="max-w-md">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label="Guruh nomi" error={errors.name?.message} {...register("name")} />
        <Input label="Sig'imi" type="number" min={1} max={100} error={errors.capacity?.message} {...register("capacity")} />
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SelectMenu label="Holati" options={STATUS_OPTIONS} value={field.value} onChange={field.onChange} error={errors.status?.message} />
          )}
        />

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
