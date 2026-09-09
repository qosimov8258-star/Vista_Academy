"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { ChildGuardian, GuardianCabinetCredentials } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { formatPhone } from "@/lib/format";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";

/**
 * Ota-ona kabinetini ochish. Login — vasiyning telefon raqami, parol esa
 * server tomonda tasodifiy yaratiladi va faqat shu oynada bir marta
 * ko'rsatiladi: bazada xesh saqlanadi, keyin uni qayta ko'rsatib bo'lmaydi.
 */
export function ParentCabinetModal({
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
  link: ChildGuardian | null;
}) {
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<GuardianCabinetCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openMutation = useMutation({
    mutationFn: () => api.post<GuardianCabinetCredentials>(`/app/guardians/${link!.guardianId}/cabinet`),
    onSuccess: (data) => {
      setError(null);
      setCredentials(data);
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Kabinetni ochib bo'lmadi"),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.delete(`/app/guardians/${link!.guardianId}/cabinet`),
    onSuccess: () => {
      setError(null);
      setCredentials(null);
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Kabinetni yopib bo'lmadi"),
  });

  const handleClose = () => {
    setCredentials(null);
    setError(null);
    onClose();
  };

  if (!link) return null;
  const hasCabinet = link.guardian.hasCabinet === true;
  const cabinetUrl =
    typeof window !== "undefined" ? `${window.location.origin}/ota-ona/${slug}` : `/ota-ona/${slug}`;

  return (
    <Modal open={open} onClose={handleClose} title="Ota-ona kabineti">
      <div className="space-y-4">
        {error && (
          <div role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
          <p className="text-[13px] text-[var(--color-text-muted)]">Ota-ona</p>
          <p className="text-[15px] font-medium text-[var(--color-text)]">{link.guardian.fullName}</p>
          <p className="mt-0.5 text-[13px] tabular-nums text-[var(--color-text-muted)]">
            {formatPhone(link.guardian.phone)}
          </p>
        </div>

        {credentials ? (
          <>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-success-bg)] px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-success)]">
                <CheckIcon className="h-4 w-4" />
                Kabinet ochildi
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-success)]/85">
                Bu parol boshqa ko&apos;rsatilmaydi — hoziroq ota-onaga yetkazing.
              </p>
            </div>

            <Field label="Havola" value={cabinetUrl} />
            <Field label="Login (telefon)" value={credentials.login} mono />
            <Field label="Parol" value={credentials.password} mono />

            <div className="rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] px-3.5 py-3">
              <p className="flex items-start gap-2 text-[13px] text-[var(--color-warning)]">
                <AlertIcon className="mt-px h-4 w-4 shrink-0" />
                Parolni yo&apos;qotsangiz qayta ko&apos;rsatib bo&apos;lmaydi — faqat yangisini yaratasiz.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="button" onClick={handleClose}>
                Yopish
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-[var(--color-text-muted)]">
              {hasCabinet
                ? "Bu ota-onaning kabineti allaqachon ochiq. Parolni unutgan bo'lsa, yangisini yaratishingiz mumkin — eski parol ishlamay qoladi."
                : "Kabinet ochilsa, ota-ona telefon raqami va parol bilan kirib, bolasining davomati, ovqati va mashg'ulotlarini ko'radi."}
            </p>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {hasCabinet && (
                <Button
                  type="button"
                  variant="dangerSoft"
                  loading={closeMutation.isPending}
                  onClick={() => closeMutation.mutate()}
                >
                  Kabinetni yopish
                </Button>
              )}
              <Button type="button" variant="outline" onClick={handleClose}>
                Bekor qilish
              </Button>
              <Button type="button" loading={openMutation.isPending} onClick={() => openMutation.mutate()}>
                {hasCabinet ? "Yangi parol yaratish" : "Kabinet ochish"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-[var(--color-text)]">{label}</p>
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5">
        <span className={`min-w-0 flex-1 break-all text-[15px] text-[var(--color-text)] ${mono ? "font-mono" : ""}`}>
          {value}
        </span>
        <CopyButton value={value} label={`${label} nusxalash`} />
      </div>
    </div>
  );
}
