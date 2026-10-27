"use client";

import type { ReactNode } from "react";
import { BookOpen, CirclePlay } from "lucide-react";
import { IOS } from "@/components/ios/tokens";
import { IosSheet } from "@/components/ios/sheet";
import { Group, Row } from "./teacher-ui";
import { useTr } from "@/i18n/tr";

export interface GuideStep {
  title: string;
  text: string;
  /** Qadam yonidagi kichik belgi (sahifadagi haqiqiy tugmaning o'zi — tanib olish oson) */
  token?: ReactNode;
}

/** Sahifa tepasidagi "… yo'riqnomasi" qatori — bosilsa GuideSheet ochiladi */
export function GuideRow({ title, subtitle = "1 daqiqada", onOpen }: { title: string; subtitle?: string; onOpen: () => void }) {
  const tr = useTr();
  return (
    <Group>
      <Row first icon={BookOpen} title={tr(title)} subtitle={tr(subtitle)} onClick={onOpen} />
    </Group>
  );
}

/**
 * Yo'riqnoma varag'i: qisqa kirish, raqamlangan sodda qadamlar, maslahat va
 * pastda "Tushuntirish videosi" (YouTube yangi oynada). Havola `guides.ts`da;
 * `null` bo'lsa tugma "Video tez orada qo'shiladi" bo'lib kulrang turadi.
 */
export function GuideSheet({
  open,
  onClose,
  intro,
  steps,
  tip,
  videoUrl,
}: {
  open: boolean;
  onClose: () => void;
  intro: string;
  steps: GuideStep[];
  tip?: string;
  videoUrl: string | null;
}) {
  const tr = useTr();
  return (
    <IosSheet
      open={open}
      onClose={onClose}
      cancelLabel="Yopish"
      title={tr("Yo'riqnoma")}
      footer={
        videoUrl ? (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold text-white transition-transform active:scale-[0.96]"
            style={{ backgroundColor: IOS.red }}
          >
            <CirclePlay className="h-5 w-5" strokeWidth={2.2} />
            {tr("Tushuntirish videosi")}
          </a>
        ) : (
          <span className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#767680]/[0.12] text-[15px] font-medium text-[#8e8e93]">
            <CirclePlay className="h-5 w-5" strokeWidth={2} />
            {tr("Video tez orada qo'shiladi")}
          </span>
        )
      }
    >
      <div className="space-y-4">
        <p className="px-1 text-[15px] leading-relaxed text-[var(--color-text)]">{tr(intro)}</p>
        <ol className="overflow-hidden rounded-[18px] bg-white">
          {steps.map((step, i) => (
            <li key={step.title} className="relative flex gap-3.5 px-4 py-3.5">
              {i > 0 && <span className="absolute left-[56px] right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[14px] font-bold text-white">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-semibold leading-snug text-[var(--color-text)]">{tr(step.title)}</span>
                  {step.token}
                </span>
                <span className="mt-1 block text-[14.5px] leading-relaxed text-[#6e6e73]">{tr(step.text)}</span>
              </span>
            </li>
          ))}
        </ol>
        {tip && <p className="px-1 text-[13px] leading-relaxed text-[#8e8e93]">{tr(tip)}</p>}
      </div>
    </IosSheet>
  );
}
