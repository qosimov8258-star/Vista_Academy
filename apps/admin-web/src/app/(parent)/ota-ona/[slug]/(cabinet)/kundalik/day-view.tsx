"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { CheckIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";
import { EmptyCard, TONES } from "../foydali/ui";
import {
  WEEKDAYS_SHORT,
  clockOf,
  dayNumber,
  durationLabel,
  isWeekend,
  mediaUrl,
  phaseOf,
  prettyDay,
  weekdayIndex,
  type DiaryDay,
  type DiaryDaySummary,
  type DiaryItem,
  type DiaryMedia,
  type ItemPhase,
} from "./diary";
import { CameraIcon, DiaryIcon, KIND_META, PlayGlyph } from "./kinds";

/* ------------------------------------------------------------------ kunlar */

export function DayStrip({
  days,
  selected,
  onSelect,
}: {
  days: DiaryDaySummary[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  // Server bugunni birinchi beradi; tasmada esa bugun o'ngda turadi (kalendar kabi)
  const ordered = useMemo(() => [...days].reverse(), [days]);
  const scroller = useRef<HTMLDivElement>(null);
  const today = days[0]?.date;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [ordered.length]);

  return (
    <div
      ref={scroller}
      className="-mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Kunni tanlash"
    >
      {ordered.map((d) => {
        const active = d.date === selected;
        const weekend = isWeekend(d.date);
        const hasMoments = d.photos + d.videos > 0;
        return (
          <button
            key={d.date}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(d.date)}
            className={clsx(
              "flex w-[54px] shrink-0 snap-end cursor-pointer flex-col items-center gap-0.5 rounded-[18px] py-2.5 transition-colors",
              active
                ? "bg-[var(--p-coral)] text-white shadow-[0_8px_18px_-8px_rgba(255,122,102,0.8)]"
                : "bg-[var(--p-card)] text-[var(--p-ink)] shadow-[var(--p-shadow)]",
              !active && weekend && "opacity-60",
            )}
          >
            <span className={clsx("text-[11.5px] font-semibold", active ? "text-white/85" : "text-[var(--p-muted)]")}>
              {d.date === today ? "Bugun" : WEEKDAYS_SHORT[weekdayIndex(d.date)]}
            </span>
            <span className="text-[18px] font-extrabold tabular-nums leading-tight">{dayNumber(d.date)}</span>
            <span
              aria-hidden="true"
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                hasMoments
                  ? active
                    ? "bg-white"
                    : "bg-[var(--p-mint)]"
                  : d.done > 0
                    ? active
                      ? "bg-white/60"
                      : "bg-[var(--p-sun)]"
                    : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ kun */

export function DayContent({
  day,
  now,
  onOpenMedia,
}: {
  day: DiaryDay;
  now: number;
  onOpenMedia: (items: DiaryMedia[], index: number) => void;
}) {
  const isToday = day.date === day.today;
  const allMedia = useMemo(
    () =>
      [...day.media, ...day.items.flatMap((item) => item.media)].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [day],
  );
  const phases = day.items.map((_, i) => phaseOf(day.items, i, isToday, now));
  const absent = day.attendance === "ABSENT" || day.attendance === "SICK";

  if (!day.group) {
    return (
      <EmptyCard
        Icon={DiaryIcon}
        tone="sun"
        title="Guruh hali yo'q"
        text="Bolangiz guruhga qo'shilgach, kun tartibi va lahzalar shu yerda ko'rinadi."
      />
    );
  }

  const nothing = day.items.length === 0 && allMedia.length === 0;
  const openAt = (media: DiaryMedia) => onOpenMedia(allMedia, Math.max(0, allMedia.findIndex((m) => m.id === media.id)));

  return (
    <div className={styles.pop}>
      {absent && (
        <div className="mt-4 rounded-[20px] bg-[var(--p-sky)]/14 px-4 py-3 text-[14px] leading-relaxed text-[var(--p-ink)]">
          {day.attendance === "SICK" ? "Bolangiz bu kuni kasal bo'lgan." : "Bolangiz bu kuni bog'chaga kelmagan."} Quyida guruhning kuni.
        </div>
      )}

      {nothing ? (
        <EmptyCard
          Icon={DiaryIcon}
          tone={isWeekend(day.date) ? "sky" : "sun"}
          title={isWeekend(day.date) ? "Dam olish kuni" : isToday ? "Kun tartibi hali yo'q" : "Bu kun uchun yozuv yo'q"}
          text={
            isWeekend(day.date)
              ? "Bu kuni bog'cha ishlamaydi. Oila bilan yaxshi dam oling!"
              : isToday
                ? "Tarbiyachi guruhning kun tartibini kiritgach, bolangizning kuni qanday o'tayotgani shu yerda ko'rinadi."
                : "Tarbiyachi bu kuni kundalikka hech narsa yozmagan."
          }
        />
      ) : (
        <>
          <DayHero day={day} phases={phases} isToday={isToday} />
          {(allMedia.length > 0 || isToday) && <Moments media={allMedia} isToday={isToday} onOpen={openAt} />}
          {day.items.length > 0 && (
            <section className="mt-6">
              <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--p-muted)]">Kun tartibi</h2>
              <ol className="relative mt-3">
                {day.items.map((item, i) => (
                  <TimelineRow
                    key={item.key}
                    item={item}
                    phase={phases[i]}
                    last={i === day.items.length - 1}
                    onOpenMedia={openAt}
                  />
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DayHero({ day, phases, isToday }: { day: DiaryDay; phases: ItemPhase[]; isToday: boolean }) {
  const { done, total, photos, videos } = day.summary;
  const progress = total > 0 ? done / total : 0;
  const nowIndex = phases.indexOf("now");
  const nextIndex = phases.indexOf("later");
  const focus = nowIndex >= 0 ? day.items[nowIndex] : nextIndex >= 0 ? day.items[nextIndex] : null;
  const tone = TONES[focus ? KIND_META[focus.kind].tone : "mint"];
  const FocusIcon = focus ? KIND_META[focus.kind].Icon : CheckIcon;

  // Halqa: r=26 → aylana uzunligi ~163
  const circumference = 2 * Math.PI * 26;

  return (
    <section className="relative mt-5 overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] p-5 shadow-[var(--p-shadow)]">
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(110%_90%_at_100%_0%,rgba(255,183,3,0.18),transparent_60%),radial-gradient(90%_80%_at_0%_100%,rgba(86,180,245,0.14),transparent_60%)]"
      />
      <div className="relative flex items-center gap-4">
        <div className="relative h-[68px] w-[68px] shrink-0">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--p-sunken)" strokeWidth="7" />
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke="var(--p-mint)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <b className="text-[17px] font-extrabold tabular-nums leading-none text-[var(--p-ink)]">
              {done}/{total}
            </b>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-[var(--p-muted)]">
            {isToday ? "Bugun" : "O'tgan kun"} · {prettyDay(day.date)}
          </p>
          {isToday && focus ? (
            <p className={`${styles.roundedFont} mt-1 text-[19px] font-extrabold leading-snug text-[var(--p-ink)]`}>
              {nowIndex >= 0 ? "Hozir: " : "Keyingi: "}
              {focus.title}
            </p>
          ) : (
            <p className={`${styles.roundedFont} mt-1 text-[19px] font-extrabold leading-snug text-[var(--p-ink)]`}>
              {total > 0 && done === total ? "Kun yakunlandi" : `${done} ta mashg'ulot o'tdi`}
            </p>
          )}
          <p className="mt-0.5 text-[13.5px] text-[var(--p-muted)]">
            {isToday && focus
              ? `${focus.startTime}${focus.endTime ? `–${focus.endTime}` : ""} · ${KIND_META[focus.kind].label}`
              : [photos > 0 && `${photos} ta rasm`, videos > 0 && `${videos} ta video`].filter(Boolean).join(" · ") ||
                "Rasm yuklanmagan"}
          </p>
        </div>
        <span className={clsx("hidden h-11 w-11 shrink-0 items-center justify-center rounded-full min-[380px]:flex", tone.soft, tone.ink)}>
          <FocusIcon className="h-6 w-6" />
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ lahzalar */

function MediaThumb({
  media,
  className,
  onOpen,
  overlay,
  compact = false,
}: {
  media: DiaryMedia;
  className?: string;
  onOpen: () => void;
  overlay?: React.ReactNode;
  /** Kichik katak (vaqt chizig'ida): tugma kichik, davomiylik ko'rsatilmaydi */
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = media.kind === "PHOTO" ? mediaUrl(media) : media.hasPoster ? mediaUrl(media, "poster") : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={media.kind === "VIDEO" ? "Videoni ochish" : "Rasmni ochish"}
      className={clsx(
        "relative cursor-pointer overflow-hidden rounded-[16px] bg-[var(--p-sunken)] transition-transform active:scale-[0.98]",
        className,
      )}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- himoyalangan API fayli
        <img src={src} alt={media.caption ?? ""} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[var(--p-muted)]">
          <CameraIcon className="h-7 w-7" />
        </span>
      )}
      {media.kind === "VIDEO" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/15">
          <span
            className={clsx(
              "flex items-center justify-center rounded-full bg-white/90 text-[#2c2320] shadow-lg",
              compact ? "h-7 w-7" : "h-11 w-11",
            )}
          >
            <PlayGlyph className={clsx("ml-0.5", compact ? "h-3.5 w-3.5" : "h-5 w-5")} />
          </span>
          {!compact && durationLabel(media.durationSeconds) && (
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
              {durationLabel(media.durationSeconds)}
            </span>
          )}
        </span>
      )}
      {overlay}
    </button>
  );
}

function Moments({ media, isToday, onOpen }: { media: DiaryMedia[]; isToday: boolean; onOpen: (media: DiaryMedia) => void }) {
  if (media.length === 0) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-dashed border-[var(--p-line)] px-4 py-3.5 text-[13.5px] leading-snug text-[var(--p-muted)]">
        <CameraIcon className="h-6 w-6 shrink-0" />
        {isToday ? "Tarbiyachi kun davomida rasm va video yuklaydi — shu yerda paydo bo'ladi." : "Bu kuni rasm yuklanmagan."}
      </div>
    );
  }

  // Birinchisi katta, yonida ikkita kichik; ko'proq bo'lsa ikkinchisida "+N"
  const [first, ...rest] = media;
  const shown = rest.slice(0, 2);
  const hidden = rest.length - shown.length;

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--p-muted)]">Kun lahzalari</h2>
        <span className="text-[12.5px] text-[var(--p-muted)]">{media.length} ta</span>
      </div>
      <div className={clsx("mt-3 grid gap-2", shown.length > 0 ? "grid-cols-3" : "grid-cols-1")}>
        <MediaThumb
          media={first}
          onOpen={() => onOpen(first)}
          className={shown.length > 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-[4/3]"}
        />
        {shown.map((m, i) => (
          <MediaThumb
            key={m.id}
            media={m}
            onOpen={() => onOpen(m)}
            className="aspect-square"
            overlay={
              i === shown.length - 1 && hidden > 0 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[20px] font-extrabold text-white">
                  +{hidden}
                </span>
              ) : undefined
            }
          />
        ))}
      </div>
      {first.caption && <p className="mt-2 text-[13.5px] leading-snug text-[var(--p-muted)]">{first.caption}</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ vaqt chizig'i */

const PHASE_CHIP: Record<ItemPhase, { label: string; className: string } | null> = {
  done: { label: "O'tdi", className: "bg-[var(--p-mint)]/14 text-[var(--p-mint)]" },
  now: { label: "Hozir", className: "bg-[var(--p-coral)] text-white" },
  later: { label: "Keyin", className: "bg-[var(--p-sunken)] text-[var(--p-muted)]" },
  missed: null,
};

function TimelineRow({
  item,
  phase,
  last,
  onOpenMedia,
}: {
  item: DiaryItem;
  phase: ItemPhase;
  last: boolean;
  onOpenMedia: (media: DiaryMedia) => void;
}) {
  const meta = KIND_META[item.kind];
  const tone = TONES[meta.tone];
  const chip = PHASE_CHIP[phase];
  const muted = phase === "later" || phase === "missed";

  return (
    <li className="relative flex gap-3 pb-3">
      {/* Vaqt ustuni. Juda tor ekranda yashiriladi — vaqt kartada ham yozilgan */}
      <span
        className={clsx(
          "hidden w-[44px] shrink-0 pt-3.5 text-right text-[13.5px] font-bold tabular-nums min-[360px]:block",
          muted ? "text-[var(--p-muted)]" : "text-[var(--p-ink)]",
        )}
      >
        {item.startTime}
      </span>

      {/* Chiziq va nuqta */}
      <span className="relative flex w-9 shrink-0 justify-center">
        {!last && (
          <span
            aria-hidden="true"
            className={clsx(
              "absolute bottom-[-12px] top-11 w-[2px] rounded-full",
              phase === "done" ? "bg-[var(--p-mint)]/45" : "bg-[var(--p-line)]",
            )}
          />
        )}
        <span
          className={clsx(
            "relative mt-2 flex h-9 w-9 items-center justify-center rounded-full",
            phase === "done" ? clsx(tone.solid, "text-white") : phase === "now" ? clsx(tone.soft, tone.ink, styles.diaryNow) : clsx(tone.soft, tone.ink),
            muted && "opacity-60",
          )}
        >
          <meta.Icon className="h-[19px] w-[19px]" />
        </span>
      </span>

      {/* Karta */}
      <div
        className={clsx(
          "min-w-0 flex-1 rounded-[20px] px-4 py-3",
          phase === "now"
            ? "bg-[var(--p-card)] shadow-[var(--p-shadow)] ring-2 ring-[var(--p-coral)]/35"
            : phase === "done"
              ? "bg-[var(--p-card)] shadow-[var(--p-shadow)]"
              : "bg-[var(--p-card)]/55",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={clsx("text-[15.5px] font-bold leading-snug", muted ? "text-[var(--p-muted)]" : "text-[var(--p-ink)]")}>
              {item.title}
            </p>
            <p className="mt-0.5 text-[12.5px] text-[var(--p-muted)]">
              {item.endTime ? `${item.startTime}–${item.endTime}` : item.startTime}
              {/* "Suzish · Suzish" bo'lib takrorlanmasin */}
              {item.title.toLowerCase() !== meta.label.toLowerCase() && ` · ${meta.label}`}
            </p>
          </div>
          {chip && (
            <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold", chip.className)}>{chip.label}</span>
          )}
        </div>
        {item.note && (
          <p className="mt-2 rounded-[14px] bg-[var(--p-sunken)] px-3 py-2 text-[14px] leading-relaxed text-[var(--p-ink)]">
            {item.note}
          </p>
        )}
        {item.media.length > 0 && (
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
            {item.media.map((m) => (
              <MediaThumb key={m.id} media={m} compact onOpen={() => onOpenMedia(m)} className="h-16 w-16 shrink-0 rounded-[12px]" />
            ))}
          </div>
        )}
        {item.done && item.doneByName && item.doneAt && (
          <p className="mt-2 text-[11.5px] text-[var(--p-muted)]">
            {item.doneByName} · {clockOf(item.doneAt)}
          </p>
        )}
      </div>
    </li>
  );
}
