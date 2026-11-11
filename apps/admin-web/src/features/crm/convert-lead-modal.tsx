"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useBranchContext } from "@/lib/use-branch-context";
import type { Child, Group, Lead } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FormSection } from "@/components/ios/form";
import { CheckRow } from "@/components/ios/check-row";
import { Row } from "@/components/ios/group";
import { useTr } from "@/i18n/tr";

/**
 * Arizani bola profiliga aylantirish (guruh ixtiyoriy). Ariza "Yutildi"
 * bosqichiga o'tadi — ortga qaytarib bo'lmaydi, shuning uchun ogohlantirish
 * tugma ustida turadi. Muvaffaqiyatdan keyin yangi bola profili ochiladi.
 */
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
  const [groupId, setGroupId] = useState("");

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => api.post<{ lead: Lead; child: Child }>(`/app/leads/${leadId}/convert`, { groupId: groupId || undefined }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["lead", slug, leadId] });
      queryClient.invalidateQueries({ queryKey: ["leads", slug] });
      queryClient.invalidateQueries({ queryKey: ["lead-stats", slug] });
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      onClose();
      router.push(`${base}/children/${result.child.id}`);
    },
  });
  const { reset } = mutation;

  useEffect(() => {
    if (!open) return;
    setGroupId("");
    reset();
  }, [open, reset]);

  const active = (groups ?? []).filter((group) => group.status === "ACTIVE");

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={tr("Bolaga aylantirish")}
      footer={
        <SheetPrimaryButton onClick={() => mutation.mutate()} loading={mutation.isPending}>
          {tr("Tasdiqlash")}
        </SheetPrimaryButton>
      }
    >
      <p className="rounded-[18px] bg-[#ff9500]/[0.12] px-4 py-3 text-[13.5px] leading-snug text-[#c76a00]">
        {tr("Ushbu ariza asosida yangi bola profili yaratiladi va ariza \"Yutildi\" bosqichiga o'tkaziladi. Bu amalni ortga qaytarib bo'lmaydi.")}
      </p>

      <FormSection title={tr("Guruh (ixtiyoriy)")}>
        <CheckRow label={tr("Tanlanmagan")} checked={groupId === ""} onClick={() => setGroupId("")} />
        {isLoading ? (
          <Row title={<span className="text-[#8e8e93]">{tr("Guruhlar yuklanmoqda...")}</span>} />
        ) : (
          active.map((group) => <CheckRow key={group.id} label={tr(group.name)} checked={groupId === group.id} onClick={() => setGroupId(group.id)} />)
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
