"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Lead, TenantUser } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FormSection } from "@/components/ios/form";
import { CheckRow } from "@/components/ios/check-row";
import { Row } from "@/components/ios/group";
import { IosAvatar } from "@/components/ios/pill";
import { useTr } from "@/i18n/tr";

/** Arizaga mas'ul xodimni belgilash — ro'yxatdan bittasi ✓ bilan */
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
  const tr = useTr();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [tried, setTried] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["users", slug],
    queryFn: () => api.get<TenantUser[]>("/app/users"),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => api.patch<Lead>(`/app/leads/${leadId}/assign`, { assignedToUserId: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      onClose();
    },
  });
  const { reset } = mutation;

  useEffect(() => {
    if (!open) return;
    setUserId(currentAssignedToUserId ?? "");
    setTried(false);
    reset();
  }, [open, currentAssignedToUserId, reset]);

  const submit = () => {
    setTried(true);
    if (!userId) return;
    mutation.mutate();
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={tr("Mas'ulni belgilash")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={mutation.isPending} dim={!userId}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <FormSection title={tr("Mas'ul xodim")} footer={tried && !userId ? <span className="text-[#ff3b30]">{tr("Xodimni tanlang")}</span> : undefined}>
        {usersQuery.isLoading ? (
          <Row title={<span className="text-[#8e8e93]">{tr("Yuklanmoqda...")}</span>} />
        ) : (usersQuery.data ?? []).length === 0 ? (
          <Row title={<span className="text-[#8e8e93]">{tr("Xodim topilmadi")}</span>} />
        ) : (
          (usersQuery.data ?? []).map((u) => (
            <CheckRow
              key={u.id}
              label={tr(u.fullName)}
              checked={userId === u.id}
              onClick={() => setUserId(u.id)}
              leading={<IosAvatar name={u.fullName} size={30} />}
            />
          ))
        )}
      </FormSection>

      {mutation.error && (
        <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
          {mutation.error instanceof ApiError ? tr(mutation.error.message) : tr("Kutilmagan xatolik yuz berdi")}
        </p>
      )}
    </IosSheet>
  );
}
