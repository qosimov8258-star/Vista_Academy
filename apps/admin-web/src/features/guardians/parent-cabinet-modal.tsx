"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { ChildGuardian, GuardianCabinetCredentials } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { formatDateTime, formatPhone } from "@/lib/format";
import { AlertIcon, CheckIcon, GroupIcon } from "@/components/ui/icons";

function relationLabel(t: (key: string) => string, relation: string): string {
  const map: Record<string, string> = {
    MOTHER: t("relation.motherShort"),
    FATHER: t("relation.fatherShort"),
    GRANDPARENT: t("relation.grandparentShort"),
    GUARDIAN: t("relation.guardianShort"),
    OTHER: t("relation.other"),
  };
  return map[relation] ?? relation;
}

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
  const t = useTranslations("guardians");
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
    onError: (err) => setError(err instanceof ApiError ? err.message : t("actionFailed")),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.delete(`/app/guardians/${holder!.guardianId}/cabinet`),
    onSuccess: () => {
      setError(null);
      setCredentials(null);
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("closeCabinetFailed")),
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
    <Modal open={open} onClose={handleClose} title={t("cabinetTitle")}>
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
          <p className="text-[13px] text-[var(--color-text-muted)]">{t("childLabel")}</p>
          <p className="text-[15px] font-medium text-[var(--color-text)]">{childName}</p>
        </div>

        {credentials ? (
          /* ---- Yangi parol chiqdi: bir marta ko'rsatiladi ---- */
          <>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-success-bg)] px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-success)]">
                <CheckIcon className="h-4 w-4" />
                {issuedAsReset ? t("newPasswordReady") : t("cabinetOpened")}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-success)]/85">
                {t("passwordShownOnceHint")}
                {issuedAsReset && ` ${t("oldPasswordInvalidated")}`}
              </p>
            </div>

            <Field label={t("linkLabel")} value={cabinetUrl} />
            <Field label={t("loginPhoneLabel")} value={credentials.login} mono />
            <Field label={t("passwordLabel")} value={credentials.password} mono />

            <div className="rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] px-3.5 py-3">
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--color-warning)]">
                <AlertIcon className="mt-px h-4 w-4 shrink-0" />
                {t("sharedLoginWarning")}
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <Button type="button" onClick={handleClose}>
                {t("close")}
              </Button>
            </div>
          </>
        ) : holder ? (
          /* ---- Kabinet ochiq: boshqaruv ---- */
          <>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-success)]/30 bg-[var(--color-success-bg)] px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--color-success)]">
                <CheckIcon className="h-4 w-4" />
                {t("cabinetOpen")}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-success)]/85">{t("sharedLoginNote")}</p>
            </div>

            <Field label={t("linkLabel")} value={cabinetUrl} />
            <Field label={t("loginPhoneLabel")} value={holder.guardian.phone} mono />

            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5">
                <dt className="text-[12.5px] text-[var(--color-text-muted)]">{t("whoseNumber")}</dt>
                <dd className="truncate text-[14px] font-medium text-[var(--color-text)]">
                  {holder.guardian.fullName}
                </dd>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5">
                <dt className="text-[12.5px] text-[var(--color-text-muted)]">{t("lastLogin")}</dt>
                <dd className="text-[14px] font-medium text-[var(--color-text)]">
                  {holder.guardian.lastLoginAt ? formatDateTime(holder.guardian.lastLoginAt) : t("neverLoggedIn")}
                </dd>
              </div>
            </dl>

            {confirmingReset ? (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-warning-bg)] px-3.5 py-3">
                <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--color-warning)]">
                  <AlertIcon className="mt-px h-4 w-4 shrink-0" />
                  {t("resetPasswordWarning")}
                </p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirmingReset(false)}>
                    {t("no")}
                  </Button>
                  <Button type="button" size="sm" loading={openMutation.isPending} onClick={() => openMutation.mutate()}>
                    {t("yesReset")}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-[var(--color-text-muted)]">{t("passwordHashedHint")}</p>
            )}

            {!confirmingReset && (
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="dangerSoft"
                  loading={closeMutation.isPending}
                  onClick={() => closeMutation.mutate()}
                >
                  {t("closeCabinet")}
                </Button>
                <Button type="button" variant="outline" onClick={handleClose}>
                  {t("close")}
                </Button>
                <Button type="button" onClick={() => setConfirmingReset(true)}>
                  {t("createNewPassword")}
                </Button>
              </div>
            )}
          </>
        ) : links.length === 0 ? (
          /* ---- Ota-ona biriktirilmagan ---- */
          <>
            <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] px-4 py-6 text-center">
              <GroupIcon className="mx-auto h-6 w-6 text-[var(--color-text-muted)]" />
              <p className="mt-2 text-[14px] text-[var(--color-text-muted)]">{t("attachGuardianFirst")}</p>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("close")}
              </Button>
            </div>
          </>
        ) : (
          /* ---- Kabinet ochish ---- */
          <>
            <p className="text-[14.5px] leading-relaxed text-[var(--color-text-muted)]">{t("openCabinetHint")}</p>

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
                          {link.isPrimary && <Badge tone="primary">{t("primaryBadge")}</Badge>}
                        </span>
                        <span className="mt-0.5 block text-[13px] tabular-nums text-[var(--color-text-muted)]">
                          {formatPhone(link.guardian.phone)} · {relationLabel(t, link.relation)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("cancel")}
              </Button>
              <Button
                type="button"
                disabled={!targetId}
                loading={openMutation.isPending}
                onClick={() => openMutation.mutate()}
              >
                {t("openCabinet")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const t = useTranslations("guardians");
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-[var(--color-text)]">{label}</p>
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5">
        <span className={`min-w-0 flex-1 break-all text-[15px] text-[var(--color-text)] ${mono ? "font-mono" : ""}`}>
          {value}
        </span>
        <CopyButton value={value} label={t("copyLabel", { label })} />
      </div>
    </div>
  );
}
