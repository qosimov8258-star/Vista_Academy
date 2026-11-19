"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ChevronRight, ExternalLink, Mic, Play } from "lucide-react";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import { IosIcon } from "@/features/director/ios-icon";
import { HomeSheet } from "./home-sheet";
import { useTr } from "@/i18n/tr";

/**
 * Bosh sahifadagi «O'tilgan mavzular» — tarbiyachi guruhga yuklagan oxirgi
 * mavzular (rasm, video, ovozli vazifa, hujjat) sanasi bilan, kunlar bo'yicha:
 * «Bugun», «Kecha», «Chorshanba, 18-noyabr». Bosilsa — pastdan oyna: rasm,
 * video va ovoz shu yerning o'zida, hujjat «Ochish» bilan. To'liq ro'yxat —
 * «Fayllar» bo'limida; ma'lumot o'sha sahifa bilan bitta keshdan olinadi.
 *
 * Mavzu hali yo'q yoki yuklab bo'lmasa — bo'lim umuman chiqmaydi (bosh
 * sahifa bo'sh karta bilan to'lib ketmasin).
 */

type Material = {
  id: string;
  title: string;
  description: string | null;
  kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdByName: string;
  createdAt: string;
};

/** Bosh sahifada nechta oxirgi mavzu ko'rinadi */
const SHOWN = 4;

const KIND_LABEL: Record<Material["kind"], string> = {
  IMAGE: "Rasm",
  VIDEO: "Video",
  AUDIO: "Ovozli vazifa",
  DOCUMENT: "Hujjat",
};

const WEEKDAY_FULL = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTH = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

const fileUrl = (id: string) => `${PARENT_API_URL}/app/parent/materials/${id}/file`;

/** Telefon vaqti bo'yicha kun kaliti: 2026-11-18 */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function extensionOf(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name);
  return match ? match[1].toUpperCase().slice(0, 4) : "FILE";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function GroupTopics({ slug, childId }: { slug: string; childId: string }) {
  const tr = useTr();
  const [open, setOpen] = useState<Material | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const query = useQuery({
    queryKey: ["parent-materials", childId],
    queryFn: () => parentApi.get<Material[]>(`/app/parent/children/${childId}/materials`),
    retry: false,
    refetchOnWindowFocus: true,
  });

  if (query.isLoading) {
    return <div className="mt-8 h-[196px] animate-pulse rounded-[var(--p-radius)] bg-[var(--p-sunken)] motion-reduce:animate-none" />;
  }
  const all = query.data ?? [];
  if (all.length === 0) return null;

  // Oxirgilari, kunlar bo'yicha (server yangisidan eskisiga qaytaradi)
  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const dayLabel = (date: Date) => {
    const key = dayKey(date);
    if (key === today) return tr("Bugun");
    if (key === yesterday) return tr("Kecha");
    return `${tr(WEEKDAY_FULL[date.getDay()])}, ${date.getDate()}-${tr(MONTH[date.getMonth()])}`;
  };
  const days: Array<{ key: string; label: string; items: Material[] }> = [];
  for (const item of all.slice(0, SHOWN)) {
    const date = new Date(item.createdAt);
    const key = dayKey(date);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(item);
    else days.push({ key, label: dayLabel(date), items: [item] });
  }

  return (
    <section className="mt-8">
      <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
        <h2 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">{tr("O'tilgan mavzular")}</h2>
        <Link href={`/ota-ona/${slug}/fayllar`} className="flex min-h-[44px] shrink-0 items-center gap-0.5 text-[15px] text-[var(--p-coral)]">
          {tr("Hammasi")}
          <span className="tabular-nums text-[var(--p-muted)]">&nbsp;{all.length}</span>
          <ChevronRight className="h-4 w-4 text-[var(--p-chevron)]" strokeWidth={2.6} aria-hidden="true" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
        {days.map((day, dayIndex) => (
          <div key={day.key}>
            <p className={clsx("px-4 pb-1 text-[13px] font-semibold text-[var(--p-muted)]", dayIndex === 0 ? "pt-3.5" : "pt-3")}>{day.label}</p>
            {day.items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setOpen(item)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-[var(--p-sunken)]"
              >
                <Thumb item={item} />
                <span className={clsx("flex min-w-0 flex-1 items-center gap-2 self-stretch", i > 0 && "border-t border-[var(--p-line)]")}>
                  <span className="min-w-0 flex-1 py-1">
                    <span className="line-clamp-2 break-words text-[15.5px] font-semibold leading-snug text-[var(--p-ink)]">{item.title}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-[var(--p-muted)]">
                      {tr(KIND_LABEL[item.kind])} · {item.createdByName}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[var(--p-chevron)]" strokeWidth={2.4} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        ))}
        <div className="h-1.5" />
      </div>

      {open && (
        <HomeSheet title={tr(KIND_LABEL[open.kind])} onClose={close}>
          <MaterialView item={open} dateLabel={`${dayLabel(new Date(open.createdAt))}, ${timeOf(open.createdAt)}`} />
        </HomeSheet>
      )}
    </section>
  );
}

function timeOf(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Ro'yxatdagi kichik rasm: surat — o'zi, qolganlari — rangli belgi */
function Thumb({ item }: { item: Material }) {
  if (item.kind === "IMAGE") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fileUrl(item.id)}
        alt=""
        loading="lazy"
        className="h-14 w-14 shrink-0 rounded-[14px] bg-[var(--p-sunken)] object-cover"
      />
    );
  }
  if (item.kind === "VIDEO") return <IosIcon icon={Play} tint="blue" size={56} />;
  if (item.kind === "AUDIO") return <IosIcon icon={Mic} tint="orange" size={56} />;
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[var(--p-sunken)] text-[12px] font-extrabold tracking-wide text-[var(--p-ink)]" aria-hidden="true">
      {extensionOf(item.originalName)}
    </span>
  );
}

/** Oynadagi mazmun: rasm/video/ovoz shu yerda, hujjat — «Ochish» */
function MaterialView({ item, dateLabel }: { item: Material; dateLabel: string }) {
  const tr = useTr();
  return (
    <div className="max-h-[72vh] overflow-y-auto overscroll-contain pb-1">
      {item.kind === "IMAGE" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl(item.id)} alt={item.title} className="max-h-[52vh] w-full rounded-[18px] bg-[var(--p-sunken)] object-contain" />
      )}
      {item.kind === "VIDEO" && (
        <video src={fileUrl(item.id)} controls playsInline preload="metadata" className="max-h-[52vh] w-full rounded-[18px] bg-black" />
      )}
      {item.kind === "AUDIO" && <audio src={fileUrl(item.id)} controls preload="metadata" className="w-full" />}

      <p className="mt-3.5 break-words text-[18px] font-bold leading-snug tracking-[-0.01em] text-[var(--p-ink)]">{item.title}</p>
      {item.description && (
        <p className="mt-1.5 whitespace-pre-line break-words text-[15px] leading-relaxed text-[var(--p-ink)]/80">{item.description}</p>
      )}
      <p className="mt-2 text-[13px] text-[var(--p-muted)]">
        {item.createdByName} · {dateLabel}
      </p>

      {item.kind === "DOCUMENT" && (
        <a
          href={fileUrl(item.id)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--p-coral)] text-[16px] font-semibold text-white active:opacity-90"
        >
          <ExternalLink className="h-[18px] w-[18px]" strokeWidth={2.4} />
          {tr("Ochish")} · {extensionOf(item.originalName)}
        </a>
      )}
    </div>
  );
}
