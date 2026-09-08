"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AGE_GROUP_LABEL, SOURCE_LABEL } from "./labels";

const schema = z.object({
  childFullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
  childBirthDate: z.string().optional(),
  ageGroup: z.string().optional(),
  parentName: z.string().min(2, "To'liq ism kamida 2 belgi"),
  parentPhone: z.string().min(5, "Telefon raqamini kiriting"),
  source: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CreateLeadModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Lead>("/app/leads", {
        ...values,
        childBirthDate: values.childBirthDate || undefined,
        ageGroup: values.ageGroup || undefined,
        source: values.source || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi ariza">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input
          label="Bolaning to'liq ismi"
          placeholder="Aliyev Sardor"
          error={errors.childFullName?.message}
          {...register("childFullName")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Tug'ilgan sana (ixtiyoriy)" type="date" error={errors.childBirthDate?.message} {...register("childBirthDate")} />
          <Select label="Yosh guruhi (ixtiyoriy)" defaultValue="" {...register("ageGroup")}>
            <option value="">Tanlanmagan</option>
            {Object.entries(AGE_GROUP_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Input
          label="Ota-ona ismi"
          placeholder="Aziza Karimova"
          error={errors.parentName?.message}
          {...register("parentName")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Ota-ona telefoni"
            placeholder="+998901234567"
            error={errors.parentPhone?.message}
            {...register("parentPhone")}
          />
          <Select label="Manba (ixtiyoriy)" defaultValue="" {...register("source")}>
            <option value="">Tanlanmagan</option>
            {Object.entries(SOURCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

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
