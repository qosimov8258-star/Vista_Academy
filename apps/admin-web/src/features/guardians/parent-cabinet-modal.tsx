"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { ChildGuardian, GuardianCabinetCredentials } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { formatDateTime, formatPhone } from "@/lib/format";
import { AlertIcon, CheckIcon, GroupIcon } from "@/components/ui/icons";

const RELATION_LABEL: Record<string, string> = {
  MOTHER: "Onasi",
  FATHER: "Otasi",
  GRANDPARENT: "Buvasi/buvisi",
  GUARDIAN: "Vasiysi",
  OTHER: "Boshqa",
};

/**
 * Bitta bolaga — bitta kabinet. Ota ham, ona ham shu bitta login bilan
 * kiradi, shuning uchun oyna bolaga tegishli: kabinet ochiq bo'lsa faqat
 * boshqaruv ko'rinadi, ikkinchi marta ochish taklif qilinmaydi.
 *
 * Parol server tomonda yaratiladi va faqat bir marta ko'rsatiladi — bazada
 * xesh saqlanadi. Shuning uchun "ko'rish" emas, "yangilash" bor.
 */
export function ParentCabinetModal({
  open,
  onClose,
  slug,
  childId,
  childName,
  links,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
  childName: string;
  links: ChildGuardian[];
}) {
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<GuardianCabinetCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  // Amal tugagach ro'yxat yangilanadi va kabinet egasi paydo bo'ladi, shuning
  // uchun "ochildi"mi yoki "yangilandi"mi — buni so'rov ketishidan oldin belgilaymiz.
  const [issuedAsReset, setIssuedAsReset] = useState(false);

  const holder = useMemo(() => links.find((link) => link.guardian.hasCabinet) ?? null, [links]);
  // Kabinet yo'q bo'lsa — login qaysi raqam bo'lishini tanlaymiz.
  // Ikkalasi bir kabinetdan foydalangani uchun bu faqat "qaysi raqam" savoli.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = pickedId ?? (links.find((link) => link.isPrimary) ?? links[0])?.guardianId ?? null;
  const targetId = holder?.guardianId ?? picked;

  const openMutation = useMutation({
    mutationFn: () => api.post<GuardianCabinetCredentials>(`/app/guardians/${targetId}/cabinet`),
    onMutate: () => setIssuedAsReset(!!holder),
    onSuccess: (data) => {
      setError(null);
      setConfirmingReset(false);
      setCredentials(data);
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Amalni bajarib bo'lmadi"),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.delete(`/app/guardians/${holder!.guardianId}/cabinet`),
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
    setConfirmingReset(false);
    setIssuedAsReset(false);
    onClose();
  };

  const cabinetUrl =
    typeof window !== "undefined" ? `${window.location.origin}/ota-ona/${slug}` : `/ota-ona/${slug}`;

  return (
    <Modal open={open} onClose={handleClose} title="Ota-ona kabineti">
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[14px] leading-relaxed text-[var(--color-danger)]"
          >
            {error}
          </div>
        )}

        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-3">
          <p className="text-[13px] text-[var(--color-text-muted)]">Bola</p>
          <p className="text-[15px] font-medium text-[var(--color-text)]">{childName}</p>
        </div>

        {credentials ? (
          /* ---- Yangi parol chiqdi: bir marta ko'rsatiladi ---- */
          <>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-success-bg)] px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-success)]">
                <CheckIcon className="h-4 w-4" />
                {issuedAsReset ? "Yangi parol tayyor" : "Kabinet ochildi"}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-success)]/85">
                Bu parol boshqa ko&apos;rsatilmaydi — hoziroq ota-onaga yetkazing.
                {issuedAsReset && " Eski parol shu daqiqadan ishlamaydi."}
              </p>
            </div>

            <Field label="Havola" value={cabinetUrl} />
            <Field label="Login (telefon)" value={credentials.login} mono />
            <Field label="Parol" value={credentials.password} mono />

            <div className="rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] px-3.5 py-3">
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--color-warning)]">
                <AlertIcon className="mt-px h-4 w-4 shrink-0" />
                Ota va ona shu bitta login bilan kiradi. Parol unutilsa qayta ko&apos;rsatib bo&apos;lmaydi —
                faqat yangisini yaratasiz.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="button" onClick={handleClose}>
                Yopish
              </Button>
            </div>
          </>
        ) : holder ? (
          /* ---- Kabinet ochiq: boshqaruv ---- */
          <>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-success)]">
                <CheckIcon className="h-4 w-4" />
                Kabinet ochiq
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-success)]/85">
                Ota va ona shu bitta login bilan kiradi.
              </p>
            </div>

            <Field label="Havola" value={cabinetUrl} />
            <Field label="Login (telefon)" value={holder.guardian.phone} mono />

            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5">
                <dt className="text-[12.5px] text-[var(--color-text-muted)]">Kimning raqami</dt>
                <dd className="truncate text-[14px] font-medium text-[var(--color-text)]">
                  {holder.guardian.fullName}
                </dd>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5">
                <dt className="text-[12.5px] text-[var(--color-text-muted)]">Oxirgi kirish</dt>
                <dd className="text-[14px] font-medium text-[var(--color-text)]">
                  {holder.guardian.lastLoginAt ? formatDateTime(holder.guardian.lastLoginAt) : "Hali kirmagan"}
                </dd>
              </div>
            </dl>

            {confirmingReset ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] px-3.5 py-3">
                <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--color-warning)]">
                  <AlertIcon className="mt-px h-4 w-4 shrink-0" />
                  Yangi parol yaratilsa, eski parol darhol ishlamay qoladi va ota-ona tizimdan chiqariladi.
                  Davom etamizmi?
                </p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingReset(false)}>
                    Yo&apos;q
                  </Button>
                  <Button type="button" size="sm" loading={openMutation.isPending} onClick={() => openMutation.mutate()}>
                    Ha, yangilansin
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-[var(--color-text-muted)]">
                Parolni qayta ko&apos;rsatib bo&apos;lmaydi — u bazada xeshlangan holda saqlanadi. Ota-ona
                parolni unutgan bo&apos;lsa, yangisini yaratib bering.
              </p>
            )}

            {!confirmingReset && (
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="dangerSoft"
                  loading={closeMutation.isPending}
                  onClick={() => closeMutation.mutate()}
                >
                  Kabinetni yopish
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Yopish
                </Button>
                <Button type="button" onClick={() => setConfirmingReset(true)}>
                  Yangi parol yaratish
                </Button>
              </div>
            )}
          </>
        ) : links.length === 0 ? (
          /* ---- Ota-ona biriktirilmagan ---- */
          <>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-4 py-6 text-center">
              <GroupIcon className="mx-auto h-6 w-6 text-[var(--color-text-muted)]" />
              <p className="mt-2 text-[14px] text-[var(--color-text-muted)]">
                Avval bolaga ota-ona biriktiring — kabinet logini uning telefon raqami bo&apos;ladi.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={handleClose}>
                Yopish
              </Button>
            </div>
          </>
        ) : (
          /* ---- Kabinet ochish ---- */
          <>
            <p className="text-[14.5px] leading-relaxed text-[var(--color-text-muted)]">
              Bolaga bitta kabinet ochiladi — ota ham, ona ham shu login bilan kirib, davomat, ovqat va
              mashg&apos;ulotlarni ko&apos;radi. Login sifatida qaysi raqam ishlatilsin?
            </p>

            <ul className="space-y-2">
              {links.map((link) => {
                const isPicked = link.guardianId === picked;
                return (
                  <li key={link.id}>
                    <button
                      type="button"
                      onClick={() => setPickedId(link.guardianId)}
                      aria-pressed={isPicked}
                      className={clsx(
                        "flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 text-left transition-colors",
                        isPicked
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.06]"
                          : "border-[var(--color-border-hair)] hover:bg-[var(--color-surface-sunken)]",
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isPicked ? "border-[var(--color-primary)]" : "border-[var(--color-border)]",
                        )}
                      >
                        {isPicked && <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-[15px] font-medium text-[var(--color-text)]">
                            {link.guardian.fullName}
                          </span>
                          {link.isPrimary && <Badge tone="primary">Asosiy</Badge>}
                        </span>
                        <span className="mt-0.5 block text-[13px] tabular-nums text-[var(--color-text-muted)]">
                          {formatPhone(link.guardian.phone)} · {RELATION_LABEL[link.relation] ?? link.relation}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>
                Bekor qilish
              </Button>
              <Button
                type="button"
                disabled={!targetId}
                loading={openMutation.isPending}
                onClick={() => openMutation.mutate()}
              >
                Kabinet ochish
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
