"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { ChildGuardian } from "@/lib/types";
import { formatPhone } from "@/lib/format";
import { IosAvatar } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { GuardianPermissionsSection, GuardianRelationSection } from "./add-guardian-modal";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  relation: z.enum(["FATHER", "MOTHER", "GRANDPARENT", "OTHER"]),
  isPrimary: z.boolean(),
  canPickup: z.boolean(),
  canViewFinance: z.boolean(),
  canReceiveNotifications: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function EditGuardianLinkModal({
  open,
  onClose,
  slug,
  childId,
  link,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
  link: ChildGuardian;
}) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      relation: link.relation,
      isPrimary: link.isPrimary,
      canPickup: link.canPickup,
      canViewFinance: link.canViewFinance,
      canReceiveNotifications: link.canReceiveNotifications,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch(`/app/child-guardians/${link.id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
      // Ro'yxatdagi ustun asosiy vasiyni ko'rsatadi — shu ham yangilansin.
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const pending = isSubmitting || mutation.isPending;

  return (
    <IosSheet
      open={open}
      onClose={() => !pending && onClose()}
      title={tr("Huquqlarni tahrirlash")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={pending}>
          {tr("Saqlash")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div className="flex flex-col items-center gap-1.5 pt-1 text-center">
          <IosAvatar name={link.guardian.fullName} size={64} />
          <p className="max-w-full truncate text-[17px] font-semibold text-[var(--color-text)]">{tr(link.guardian.fullName)}</p>
          <p className="text-[13px] tabular-nums text-[#8e8e93]">{formatPhone(link.guardian.phone)}</p>
        </div>

        {serverError && (
          <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13px] leading-snug text-[#ff3b30]">
            {tr(serverError)}
          </p>
        )}

        <GuardianRelationSection control={control} />
        <GuardianPermissionsSection control={control} />
      </form>
    </IosSheet>
  );
}
