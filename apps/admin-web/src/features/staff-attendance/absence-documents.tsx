"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileImage, FileText, Paperclip, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { openFile } from "@/lib/download";
import type { StaffAbsenceDocument, StaffDocumentKind } from "@/lib/types";
import { TextInput } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { IosIcon } from "@/features/director/ios-icon";
import { useTr } from "@/i18n/tr";

export const DOCUMENT_KIND_LABEL: Record<StaffDocumentKind, string> = {
  SICK_NOTE: "Kasallik varaqasi",
  LEAVE_REQUEST: "Ariza",
  OTHER: "Boshqa hujjat",
};

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

/** ["2026-10-03", "2026-10-04", "2026-10-07"] → "3, 4, 7-oktabr" (bir oy ichida) */
export function datesLabel(dates: string[]): string {
  const sorted = [...dates].sort();
  const byMonth = new Map<string, number[]>();
  for (const d of sorted) byMonth.set(d.slice(0, 7), [...(byMonth.get(d.slice(0, 7)) ?? []), Number(d.slice(8))]);
  return [...byMonth.entries()].map(([ym, days]) => `${days.join(", ")}-${MONTHS[Number(ym.slice(5)) - 1]}`).join("; ");
}

export const documentFilePath = (id: string) => `/app/staff-attendance/documents/${id}/file`;

/** Hujjatni yangi oynada ochadi (token bilan) */
export function useOpenDocument() {
  const tr = useTr();
  const [error, setError] = useState<string | null>(null);
  const open = (id: string) => {
    setError(null);
    openFile(documentFilePath(id)).catch(() => setError(tr("Hujjatni ochib bo'lmadi — qayta urinib ko'ring")));
  };
  return { open, error };
}

/** Kun qatoridagi kichik «qisqich» belgi — bosilsa hujjat ochiladi */
export function DocumentChip({ kind, onOpen }: { kind: StaffDocumentKind; onOpen: () => void }) {
  const tr = useTr();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="inline-flex h-6 items-center gap-1 rounded-full bg-[#007aff]/[0.12] px-2 text-[12px] font-medium text-[#007aff] active:opacity-70"
    >
      <Paperclip className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
      {tr(DOCUMENT_KIND_LABEL[kind])}
    </button>
  );
}

const MAX_SIZE = 10 * 1024 * 1024;
const KINDS: StaffDocumentKind[] = ["SICK_NOTE", "LEAVE_REQUEST", "OTHER"];

/**
 * Tanlangan kelmagan kunlar uchun bitta hujjat yuklash: turi, fayl (rasm
 * yoki PDF — telefonda kamera ham), ixtiyoriy izoh.
 */
export function DocumentUploadSheet({
  open,
  onClose,
  slug,
  employeeId,
  employeeName,
  dates,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  employeeId: string;
  employeeName: string;
  dates: string[];
  onUploaded: () => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<StaffDocumentKind>("SICK_NOTE");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind("SICK_NOTE");
    setFile(null);
    setNote("");
    setFileError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      api.upload<StaffAbsenceDocument>("/app/staff-attendance/documents", file!, {
        employeeId,
        dates: dates.join(","),
        kind,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance-history", slug] });
      queryClient.invalidateQueries({ queryKey: ["staff-attendance", slug] });
      onUploaded();
      onClose();
    },
  });

  const pick = (f: File | undefined) => {
    setFileError(null);
    if (!f) return;
    if (f.size > MAX_SIZE) return setFileError(tr("Fayl 10 MB dan katta bo'lmasin"));
    if (!/^(image\/|application\/pdf$)/.test(f.type)) return setFileError(tr("Faqat rasm yoki PDF fayl"));
    setFile(f);
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      cancelLabel="Bekor"
      title={tr("Hujjat yuklash")}
      footer={
        <SheetPrimaryButton dim={!file} loading={mutation.isPending} onClick={() => file && mutation.mutate()}>
          {tr("Yuklash")}
        </SheetPrimaryButton>
      }
    >
      <SheetSection>
        <SheetRow label={tr("Xodim")}>
          <span className="text-[var(--color-text)]">{tr(employeeName)}</span>
        </SheetRow>
        <SheetRow label={tr("Kunlar")}>
          <span className="text-[var(--color-text)]">
            {datesLabel(dates)} · {tr("{0} kun", dates.length)}
          </span>
        </SheetRow>
      </SheetSection>

      <SheetSection title={tr("Hujjat turi")}>
        <div role="radiogroup" aria-label={tr("Hujjat turi")} className="flex flex-wrap gap-2 p-3">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={clsx(
                "h-10 rounded-full px-4 text-[15px] font-medium transition-transform active:scale-[0.96]",
                kind === k ? "bg-[#007aff]/[0.15] text-[#007aff]" : "bg-[#767680]/[0.12] text-[var(--color-text)]",
              )}
            >
              {tr(DOCUMENT_KIND_LABEL[k])}
            </button>
          ))}
        </div>
      </SheetSection>

      <SheetSection title={tr("Fayl")} footer={fileError ?? tr("Rasm (telefonda kamera bilan suratga olsa ham bo'ladi) yoki PDF, 10 MB gacha.")}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/[0.04]">
          <IosIcon icon={file ? (file.type === "application/pdf" ? FileText : FileImage) : Upload} tint={file ? "blue" : "gray"} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-medium text-[var(--color-text)]">{file ? file.name : tr("Rasm yoki PDF tanlash")}</span>
            <span className="block text-[13px] text-[#8e8e93]">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ${tr("almashtirish uchun bosing")}` : tr("Kasallik varaqasi, ariza va h.k.")}</span>
          </span>
        </button>
      </SheetSection>

      <SheetSection title={tr("Izoh")}>
        <div className="px-4 py-2">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={tr("Ixtiyoriy, masalan: poliklinika №3")} />
        </div>
      </SheetSection>

      {mutation.isError && <p className="px-4 text-[13px] text-[#ff3b30]">{tr((mutation.error as Error).message)}</p>}
    </IosSheet>
  );
}

/** Hujjat tafsiloti: ochish va (admin uchun) ikki bosqichli o'chirish */
export function DocumentSheet({
  document: doc,
  onClose,
  slug,
  canWrite,
}: {
  document: StaffAbsenceDocument | null;
  onClose: () => void;
  slug: string;
  canWrite: boolean;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const { open, error } = useOpenDocument();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [doc?.id]);

  const remove = useMutation({
    mutationFn: () => api.delete(`/app/staff-attendance/documents/${doc!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-attendance-history", slug] });
      queryClient.invalidateQueries({ queryKey: ["staff-attendance", slug] });
      onClose();
    },
  });

  const isPdf = doc?.mimeType === "application/pdf";
  return (
    <IosSheet
      open={!!doc}
      onClose={() => !remove.isPending && onClose()}
      cancelLabel="Yopish"
      title={doc ? tr(DOCUMENT_KIND_LABEL[doc.kind]) : ""}
      footer={
        doc ? (
          confirming ? (
            <div className="space-y-2">
              <p className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[14px] text-[#d70015]">{tr("Hujjat o'chiriladi. Bu isbot bo'lgani uchun faqat xato yuklangan bo'lsa o'chiring.")}</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SheetSecondaryButton onClick={() => setConfirming(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
                </div>
                <div className="flex-1">
                  <SheetSecondaryButton danger onClick={() => remove.mutate()}>
                    {tr("O'chirish")}
                  </SheetSecondaryButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <SheetPrimaryButton onClick={() => open(doc.id)}>{tr(isPdf ? "PDF ni ochish" : "Rasmni ochish")}</SheetPrimaryButton>
              {canWrite && (
                <SheetSecondaryButton danger onClick={() => setConfirming(true)}>
                  {tr("O'chirish")}
                </SheetSecondaryButton>
              )}
            </div>
          )
        ) : undefined
      }
    >
      {doc && (
        <>
          <div className="flex flex-col items-center gap-2 text-center">
            <IosIcon icon={isPdf ? FileText : FileImage} tint="blue" size={56} />
            <p className="max-w-full truncate text-[15px] font-medium text-[var(--color-text)]">{doc.fileName}</p>
          </div>
          <SheetSection>
            <SheetRow label={tr("Kunlar")}>
              <span className="text-[var(--color-text)]">{datesLabel(doc.dates)}</span>
            </SheetRow>
            {doc.note && (
              <SheetRow label={tr("Izoh")}>
                <span className="text-[var(--color-text)]">{tr(doc.note)}</span>
              </SheetRow>
            )}
            <SheetRow label={tr("Yukladi")}>
              <span>
                {tr(doc.uploadedByName)} · {new Date(doc.createdAt).toLocaleDateString("ru-RU")}
              </span>
            </SheetRow>
          </SheetSection>
          {(error || remove.isError) && <p className="px-4 text-[13px] text-[#ff3b30]">{error ?? tr("O'chirib bo'lmadi")}</p>}
        </>
      )}
    </IosSheet>
  );
}
