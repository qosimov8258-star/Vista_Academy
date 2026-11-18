"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Child, Group } from "@/lib/types";
import { FieldRow } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { ChildGroupPicker } from "@/features/children/create-child-modal";
import { useTr } from "@/i18n/tr";
import { GroupFullPrompt } from "./group-full-prompt";

/**
 * Arxivdan qaytarish: bola qaysi guruhga qaytishi tanlanadi (majburiy —
 * aks holda yana «Guruhsiz»da qolardi) va u yana faol bo'ladi. Guruh to'lgan
 * bo'lsa — odatdagi «Baribir saqlash» so'rovi.
 */
export function RestoreChildSheet({ open, onClose, slug, child }: { open: boolean; onClose: () => void; slug: string; child: Child }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [groupFull, setGroupFull] = useState<string | null>(null);
  const allowOverCapacity = useRef(false);

  useEffect(() => {
    if (!open) return;
    setGroupId("");
    setError(null);
    setGroupFull(null);
  }, [open]);

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open,
  });
  const activeGroups = useMemo(() => groups?.filter((g) => g.status === "ACTIVE") ?? [], [groups]);

  const restore = useMutation({
    mutationFn: () =>
      api.patch<Child>(`/app/children/${child.id}`, { status: "ACTIVE", groupId, allowOverCapacity: allowOverCapacity.current || undefined }),
    onSuccess: () => {
      // Guruh soni, davomat va bosh sahifa hisoblari ham o'zgaradi
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "GROUP_FULL") {
        setGroupFull(err.message);
        return;
      }
      setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
    onSettled: () => {
      allowOverCapacity.current = false;
    },
  });

  const submit = () => {
    if (!groupId || restore.isPending) return;
    setError(null);
    setGroupFull(null);
    restore.mutate();
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !restore.isPending && onClose()}
      cancelLabel="Bekor qilish"
      title={tr("Arxivdan qaytarish")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={restore.isPending} dim={!groupId}>
          {tr("Qaytarish")}
        </SheetPrimaryButton>
      }
    >
      {groupFull && (
        <GroupFullPrompt
          message={groupFull}
          confirmLabel="Baribir saqlash"
          loading={restore.isPending}
          onCancel={() => setGroupFull(null)}
          onConfirm={() => {
            allowOverCapacity.current = true;
            submit();
          }}
        />
      )}
      <SheetSection footer={tr("{0} yana faol bo'ladi va tanlangan guruhga qo'shiladi.", tr(child.fullName))}>
        <FieldRow label={tr("Guruh")} htmlFor="restore-child-group">
          <ChildGroupPicker
            id="restore-child-group"
            title={tr("Guruh")}
            value={groupId}
            onChange={setGroupId}
            groups={activeGroups}
            loading={!groups}
            placeholder={tr("Guruhni tanlang")}
          />
        </FieldRow>
      </SheetSection>
      {error && (
        <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[13.5px] leading-snug text-[#ff3b30]">
          {tr(error)}
        </p>
      )}
    </IosSheet>
  );
}
