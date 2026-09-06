"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Child, Group, Lead } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  groupId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ConvertLeadModal({
  open,
  onClose,
  slug,
  leadId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  leadId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<{ lead: Lead; child: Child }>(`/app/leads/${leadId}/convert`, {
        groupId: values.groupId || undefined,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats", slug] });
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      reset();
      onClose();
      router.push(`/${slug}/children/${result.child.id}`);
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Bolaga aylantirish">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <p className="text-sm text-[var(--color-text-muted)]">
          Ushbu ariza asosida yangi bola profili yaratiladi va ariza &quot;Yutildi&quot; bosqichiga o&apos;tkaziladi. Bu amalni
          ortga qaytarib bo&apos;lmaydi.
        </p>
        <Select label="Guruh (ixtiyoriy)" defaultValue="" {...register("groupId")}>
          <option value="">Tanlanmagan</option>
          {groups?.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Tasdiqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
