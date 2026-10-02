"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useBranchContext } from "@/lib/use-branch-context";
import type { Child, Group, Lead } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTr } from "@/i18n/tr";

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
  const tr = useTr();
  const router = useRouter();
  const { base } = useBranchContext(slug);
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
      router.push(`${base}/children/${result.child.id}`);
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={tr("Bolaga aylantirish")}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}
        <p className="text-sm text-[var(--color-text-muted)]">
          {tr("Ushbu ariza asosida yangi bola profili yaratiladi va ariza \"Yutildi\" bosqichiga o'tkaziladi. Bu amalni ortga qaytarib bo'lmaydi.")}
        </p>
        <Select label={tr("Guruh (ixtiyoriy)")} defaultValue="" {...register("groupId")}>
          <option value="">{tr("Tanlanmagan")}</option>
          {groups?.map((group) => (
            <option key={group.id} value={group.id}>
              {tr(group.name)}
            </option>
          ))}
        </Select>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr("Bekor qilish")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {tr("Tasdiqlash")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
