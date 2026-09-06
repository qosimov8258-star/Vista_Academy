"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LeadActivity } from "@/lib/types";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ACTIVITY_LABEL } from "./labels";

const schema = z.object({
  type: z.enum(["CALL", "MESSAGE", "MEETING", "TRIAL_DAY", "STAGE_CHANGE", "NOTE"]),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LeadActivityForm({ slug, leadId }: { slug: string; leadId: string }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { type: "NOTE", note: "" } });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<LeadActivity>(`/app/leads/${leadId}/activities`, {
        type: values.type,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      reset({ type: "NOTE", note: "" });
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <form className="space-y-3" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      {serverError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {serverError}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
        <Select label="Turi" {...register("type")}>
          {Object.entries(ACTIVITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Textarea label="Izoh (ixtiyoriy)" rows={2} placeholder="Qo'shimcha ma'lumot" {...register("note")} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={isSubmitting || mutation.isPending}>
          Qo&apos;shish
        </Button>
      </div>
    </form>
  );
}
