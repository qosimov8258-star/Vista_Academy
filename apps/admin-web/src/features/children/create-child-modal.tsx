"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Child, Group } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  groupId: z.string().optional(),
  fullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
  birthDate: z.string().optional(),
  guardianFullName: z.string().min(2, "Ota-ona ismi kamida 2 belgi"),
  guardianRelation: z.enum(["MOTHER", "FATHER", "GRANDPARENT", "OTHER"]),
  guardianPhone: z
    .string()
    .refine((v) => v.replace(/\D/g, "").length >= 9, "Telefon raqami to'liq emas"),
});

type FormValues = z.infer<typeof schema>;

export function CreateChildModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { guardianRelation: "MOTHER" },
  });

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Child>("/app/children", {
        ...values,
        groupId: values.groupId || undefined,
        birthDate: values.birthDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi bola">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <Input
          label="Bolaning ismi va familiyasi"
          placeholder="Usmon Umaraliyev"
          hint="Saqlanganda bolaga qisqa ID beriladi (masalan id14732)"
          error={errors.fullName?.message}
          {...register("fullName")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Tug'ilgan sana" type="date" error={errors.birthDate?.message} {...register("birthDate")} />
          <Select label="Guruh (ixtiyoriy)" defaultValue="" {...register("groupId")}>
            <option value="">Tanlanmagan</option>
            {groups?.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
          <p className="text-sm font-medium text-[var(--color-text)]">
            Aloqa uchun ota-ona
            <span className="ml-2 font-normal text-[var(--color-text-muted)]">
              bog&apos;cha shu raqamga qo&apos;ng&apos;iroq qiladi
            </span>
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
            <Input
              label="Ismi va familiyasi"
              placeholder="Aziza Umaraliyeva"
              error={errors.guardianFullName?.message}
              {...register("guardianFullName")}
            />
            <Select label="Kim bo'ladi" {...register("guardianRelation")}>
              <option value="MOTHER">Onasi</option>
              <option value="FATHER">Otasi</option>
              <option value="GRANDPARENT">Buvi/bobo</option>
              <option value="OTHER">Boshqa</option>
            </Select>
          </div>
          <Input
            label="Telefon raqami"
            type="tel"
            placeholder="+998 90 123 45 67"
            hint="Xuddi shu raqam bilan yana bola qo'shilsa, ikkalasi bir ota-onaga bog'lanadi"
            error={errors.guardianPhone?.message}
            {...register("guardianPhone")}
          />
        </div>

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
