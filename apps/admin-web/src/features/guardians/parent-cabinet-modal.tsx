"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, Copy, KeyRound, LockKeyhole, TriangleAlert, UsersRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ChildGuardian, GuardianCabinetCredentials } from "@/lib/types";
import { formatDateTime, formatPhone } from "@/lib/format";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { IOS, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

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
 *
 * Xavfli amallar (yangi parol, kabinetni yopish) — varaq ichidagi ikkinchi
 * bosqichda tasdiqlanadi.
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
  const tr = useTr();
  const queryClient = useQueryClient();
  const [credentials, setCredentials] = useState<GuardianCabinetCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
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
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Amalni bajarib bo'lmadi")),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.delete(`/app/guardians/${holder!.guardianId}/cabinet`),
    onSuccess: () => {
      setError(null);
      setCredentials(null);
      setConfirmingClose(false);
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kabinetni yopib bo'lmadi")),
  });

  const pending = openMutation.isPending || closeMutation.isPending;

  const handleClose = () => {
    setCredentials(null);
    setError(null);
    setConfirmingReset(false);
    setConfirmingClose(false);
    setIssuedAsReset(false);
    onClose();
  };

  const backToMain = () => {
    setError(null);
    setConfirmingReset(false);
    setConfirmingClose(false);
  };

  const cabinetUrl =
    typeof window !== "undefined" ? `${window.location.origin}/ota-ona/${slug}` : `/ota-ona/${slug}`;

  const errorNote = error && (
    <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13px] leading-snug text-[#ff3b30]">
      {tr(error)}
    </p>
  );

  const childRow = (
    <SheetSection>
      <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5">
        <IosAvatar name={childName} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-[#8e8e93]">{tr("Bola")}</span>
          <span className="block truncate text-[15px] font-medium text-[var(--color-text)]">{tr(childName)}</span>
        </span>
      </div>
    </SheetSection>
  );

  // ---- Tasdiqlash bosqichlari (yangi parol / kabinetni yopish) ----
  const confirming = !credentials && holder && (confirmingReset || confirmingClose);
  if (confirming) {
    const isReset = confirmingReset;
    const mutation = isReset ? openMutation : closeMutation;
    return (
      <IosSheet
        open={open}
        onClose={() => !pending && backToMain()}
        title={isReset ? tr("Yangi parol yaratish") : tr("Kabinetni yopish")}
        cancelLabel="Orqaga"
        footer={
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-transform active:scale-[0.96] disabled:opacity-60"
            >
              {mutation.isPending ? (
                <Spinner className="h-5 w-5 text-white" />
              ) : isReset ? (
                <KeyRound className="h-[18px] w-[18px]" strokeWidth={2.4} />
              ) : (
                <LockKeyhole className="h-[18px] w-[18px]" strokeWidth={2.4} />
              )}
              {isReset ? tr("Ha, yangilansin") : tr("Kabinetni yopish")}
            </button>
            <SheetSecondaryButton onClick={backToMain}>{tr("Qoldirish")}</SheetSecondaryButton>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-1.5 pt-1 text-center">
          <IosAvatar name={holder.guardian.fullName} size={64} />
          <p className="max-w-full truncate text-[17px] font-semibold text-[var(--color-text)]">{tr(holder.guardian.fullName)}</p>
          <p className="text-[13px] tabular-nums text-[#8e8e93]">{formatPhone(holder.guardian.phone)}</p>
        </div>
        <div className="flex items-start gap-3 rounded-[16px] bg-[#ff3b30]/[0.1] px-4 py-3.5" role="alert">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#ff3b30]" strokeWidth={2.2} />
          <p className="min-w-0 text-[14px] leading-snug text-[var(--color-text)]">
            {isReset
              ? tr("Yangi parol yaratilsa, eski parol darhol ishlamay qoladi va ota-ona tizimdan chiqariladi. Davom etamizmi?")
              : tr("Kabinet yopilsa, ota-ona tizimga kira olmaydi. Keyin qayta ochish mumkin — yangi parol bilan.")}
          </p>
        </div>
        {errorNote}
      </IosSheet>
    );
  }

  // ---- Yangi parol chiqdi: bir marta ko'rsatiladi ----
  if (credentials) {
    return (
      <IosSheet
        open={open}
        onClose={handleClose}
        title={tr("Ota-ona kabineti")}
        cancelLabel="Yopish"
        footer={<SheetPrimaryButton onClick={handleClose}>{tr("Yopish")}</SheetPrimaryButton>}
      >
        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#34c759]/[0.14] text-[#34c759]">
            <Check className="h-7 w-7" strokeWidth={2.6} />
          </span>
          <p className="text-[20px] font-bold text-[var(--color-text)]">{issuedAsReset ? tr("Yangi parol tayyor") : tr("Kabinet ochildi")}</p>
          <p className="max-w-[340px] text-[13px] leading-snug text-[#8e8e93]">
            {tr("Bu parol boshqa ko'rsatilmaydi — hoziroq ota-onaga yetkazing.")}
            {issuedAsReset && ` ${tr("Eski parol shu daqiqadan ishlamaydi.")}`}
          </p>
        </div>

        <SheetSection title={tr("Kirish ma'lumotlari")}>
          <CopyRow label="Login (telefon)" value={credentials.login} shown={formatPhone(credentials.login)} mono />
          <CopyRow label="Parol" value={credentials.password} mono big />
          <CopyRow label="Havola" value={cabinetUrl} />
        </SheetSection>

        <CopyAllButton
          text={`${tr("Havola")}: ${cabinetUrl}\n${tr("Login (telefon)")}: ${credentials.login}\n${tr("Parol")}: ${credentials.password}`}
        />

        <p className="flex items-start gap-2.5 rounded-[14px] bg-[#ff9500]/[0.12] px-4 py-3 text-[13px] leading-snug text-[var(--color-text)]">
          <TriangleAlert className="mt-px h-4 w-4 shrink-0 text-[#ff9500]" strokeWidth={2.4} />
          {tr("Ota va ona shu bitta login bilan kiradi. Parol unutilsa qayta ko'rsatib bo'lmaydi — faqat yangisini yaratasiz.")}
        </p>
        {errorNote}
      </IosSheet>
    );
  }

  // ---- Kabinet ochiq: boshqaruv ----
  if (holder) {
    return (
      <IosSheet
        open={open}
        onClose={() => !pending && handleClose()}
        title={tr("Ota-ona kabineti")}
        cancelLabel="Yopish"
        footer={
          <div className="space-y-2.5">
            <SheetPrimaryButton
              onClick={() => {
                setError(null);
                setConfirmingReset(true);
              }}
            >
              <KeyRound className="h-[18px] w-[18px]" strokeWidth={2.4} />
              {tr("Yangi parol yaratish")}
            </SheetPrimaryButton>
            <SheetSecondaryButton
              danger
              onClick={() => {
                setError(null);
                setConfirmingClose(true);
              }}
            >
              {tr("Kabinetni yopish")}
            </SheetSecondaryButton>
          </div>
        }
      >
        {errorNote}
        {childRow}

        <div className="flex items-start gap-3 rounded-[16px] bg-[#34c759]/[0.1] px-4 py-3">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#34c759]" strokeWidth={2.6} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Kabinet ochiq")}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-[#8e8e93]">{tr("Ota va ona shu bitta login bilan kiradi.")}</p>
          </div>
        </div>

        <SheetSection
          title={tr("Kirish ma'lumotlari")}
          footer={tr("Parolni qayta ko'rsatib bo'lmaydi — u bazada xeshlangan holda saqlanadi. Ota-ona parolni unutgan bo'lsa, yangisini yaratib bering.")}
        >
          <CopyRow label="Login (telefon)" value={holder.guardian.phone} shown={formatPhone(holder.guardian.phone)} mono />
          <CopyRow label="Havola" value={cabinetUrl} />
        </SheetSection>

        <SheetSection>
          <InfoRow label={tr("Kimning raqami")} value={tr(holder.guardian.fullName)} />
          <InfoRow
            label={tr("Oxirgi kirish")}
            value={holder.guardian.lastLoginAt ? formatDateTime(holder.guardian.lastLoginAt) : tr("Hali kirmagan")}
          />
        </SheetSection>
      </IosSheet>
    );
  }

  // ---- Ota-ona biriktirilmagan ----
  if (links.length === 0) {
    return (
      <IosSheet open={open} onClose={handleClose} title={tr("Ota-ona kabineti")} cancelLabel="Yopish">
        {childRow}
        <div className="flex flex-col items-center rounded-[18px] bg-white px-6 py-9 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#8e8e93] text-white">
            <UsersRound className="h-6 w-6" strokeWidth={2} />
          </span>
          <p className="mt-3 max-w-[300px] text-[14px] leading-snug text-[#8e8e93]">
            {tr("Avval bolaga ota-ona biriktiring — kabinet logini uning telefon raqami bo'ladi.")}
          </p>
        </div>
      </IosSheet>
    );
  }

  // ---- Kabinet ochish ----
  return (
    <IosSheet
      open={open}
      onClose={() => !pending && handleClose()}
      title={tr("Ota-ona kabineti")}
      footer={
        <SheetPrimaryButton dim={!targetId} loading={openMutation.isPending} onClick={() => targetId && openMutation.mutate()}>
          {tr("Kabinet ochish")}
        </SheetPrimaryButton>
      }
    >
      {errorNote}
      {childRow}

      <SheetSection
        title={tr("Login (telefon)")}
        footer={tr(
          "Bolaga bitta kabinet ochiladi — ota ham, ona ham shu login bilan kirib, davomat, ovqat va mashg'ulotlarni ko'radi. Login sifatida qaysi raqam ishlatilsin?",
        )}
      >
        <div role="radiogroup" aria-label={tr("Login (telefon)")}>
          {links.map((link) => {
            const isPicked = link.guardianId === picked;
            return (
              <div key={link.id} className="group/row relative">
                <button
                  type="button"
                  role="radio"
                  aria-checked={isPicked}
                  onClick={() => setPickedId(link.guardianId)}
                  className={clsx("flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left", ROW_PRESS)}
                >
                  <IosAvatar name={link.guardian.fullName} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[15px] font-medium text-[var(--color-text)]">{tr(link.guardian.fullName)}</span>
                      {link.isPrimary && <Pill color={IOS.blue}>{tr("Asosiy")}</Pill>}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] tabular-nums text-[#8e8e93]">
                      {formatPhone(link.guardian.phone)} · {tr(RELATION_LABEL[link.relation] ?? link.relation)}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                      isPicked ? "bg-[var(--color-primary)] text-white" : "ring-[1.5px] ring-inset ring-[#c7c7cc]",
                    )}
                  >
                    {isPicked && <Check className="h-4 w-4" strokeWidth={3} />}
                  </span>
                </button>
                <span className={ROW_SEPARATOR} style={{ left: 72 }} aria-hidden="true" />
              </div>
            );
          })}
        </div>
      </SheetSection>
    </IosSheet>
  );
}

/**
 * Buferga nusxalash: avval `navigator.clipboard`, u ishlamasa (masalan panel
 * http://192.168.x.x orqali ochilganda) — eski `execCommand("copy")`.
 */
function useCopy() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  const copy = async (value: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(textarea);
    }
    setState(ok ? "copied" : "failed");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1600);
  };
  return { state, copy };
}

/** Nusxalanadigan qator: tepada kulrang yorliq, ostida qiymat, o'ngda 44px tugma */
function CopyRow({ label, value, shown, mono, big }: { label: string; value: string; shown?: string; mono?: boolean; big?: boolean }) {
  const tr = useTr();
  const { state, copy } = useCopy();
  return (
    <div className="group/row relative flex min-h-[60px] items-center gap-3 py-2 pl-4 pr-2">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-[#8e8e93]">{tr(label)}</p>
        <p
          className={clsx(
            "break-all text-[var(--color-text)]",
            mono && "font-mono tabular-nums",
            big ? "text-[22px] font-semibold tracking-wide" : "text-[15px]",
          )}
        >
          {shown ?? value}
        </p>
      </div>
      <button
        type="button"
        onClick={() => copy(value)}
        aria-label={tr("{0} nusxalash", tr(label))}
        title={state === "copied" ? tr("Nusxalandi") : state === "failed" ? tr("Nusxalab bo'lmadi") : tr("Nusxalash")}
        className={clsx(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] active:scale-[0.92]",
          state === "copied"
            ? "bg-[#34c759]/[0.14] text-[#34c759]"
            : state === "failed"
              ? "bg-[#ff3b30]/[0.12] text-[#ff3b30]"
              : "bg-[var(--color-primary)]/[0.1] text-[var(--color-primary)]",
        )}
      >
        {state === "copied" ? <Check className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <Copy className="h-[18px] w-[18px]" strokeWidth={2.2} />}
      </button>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

/** Havola, login va parolni bitta matn qilib nusxalash — ota-onaga yuborish uchun */
function CopyAllButton({ text }: { text: string }) {
  const tr = useTr();
  const { state, copy } = useCopy();
  return (
    <SheetSecondaryButton onClick={() => copy(text)} danger={state === "failed"}>
      {state === "copied" ? <Check className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <Copy className="h-[18px] w-[18px]" strokeWidth={2.2} />}
      {state === "copied" ? tr("Nusxalandi") : state === "failed" ? tr("Nusxalab bo'lmadi") : tr("Hammasini nusxalash")}
    </SheetSecondaryButton>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="group/row relative flex min-h-[48px] items-center gap-3 px-4">
      <span className="shrink-0 py-3 text-[15px] text-[var(--color-text)]">{label}</span>
      <span className="min-w-0 flex-1 truncate py-3 text-right text-[15px] tabular-nums text-[#8e8e93]">{value}</span>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}
