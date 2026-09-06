"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { HealthProfile } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  bloodType: z.enum([
    "A_POSITIVE",
    "A_NEGATIVE",
    "B_POSITIVE",
    "B_NEGATIVE",
    "AB_POSITIVE",
    "AB_NEGATIVE",
    "O_POSITIVE",
    "O_NEGATIVE",
    "",
  ]),
  chronicConditions: z.string().optional(),
  allergies: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export const BLOOD_TYPE_LABEL: Record<string, string> = {
  A_POSITIVE: "A(II) Rh+",
  A_NEGATIVE: "A(II) Rh-",
  B_POSITIVE: "B(III) Rh+",
  B_NEGATIVE: "B(III) Rh-",
  AB_POSITIVE: "AB(IV) Rh+",
  AB_NEGATIVE: "AB(IV) Rh-",
  O_POSITIVE: "O(I) Rh+",
  O_NEGATIVE: "O(I) Rh-",
};

export function EditHealthProfileModal({
  open,
  onClose,
  slug,
  childId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
  existing: HealthProfile | null;
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
      bloodType: existing?.bloodType ?? "",
      chronicConditions: existing?.chronicConditions ?? "",
      allergies: existing?.allergies ?? "",
      notes: existing?.notes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(`/app/children/${childId}/health`, {
        bloodType: values.bloodType || undefined,
        chronicConditions: values.chronicConditions || undefined,
        allergies: values.allergies || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-health", slug, childId] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Sog'liq profili">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Select label="Qon guruhi" defaultValue="" {...register("bloodType")}>
          <option value="">Kiritilmagan</option>
          {Object.entries(BLOOD_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Textarea label="Allergiyalar (ixtiyoriy)" rows={2} {...register("allergies")} />
        <Textarea label="Surunkali kasalliklar (ixtiyoriy)" rows={2} {...register("chronicConditions")} />
        <Textarea label="Qo'shimcha izoh (ixtiyoriy)" rows={2} {...register("notes")} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
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
