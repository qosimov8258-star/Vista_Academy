"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ApiError } from "@/lib/api";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentAttendanceStrip, ParentChild, ParentDay } from "@/lib/types";
import { initials } from "@/components/ui/avatar";
import styles from "../parent.module.css";

const WEEKDAY = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];
/** Kalendar ustunlari — hafta dushanbadan boshlanadi */
const WEEKDAY_SHORT = ["Du", "Se", "Cho", "Pay", "Ju", "Sha", "Yak"];
const MONTH = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const EATING = {
  GOOD: { label: "Yaxshi yedi", tone: "mint" as const },
  AVERAGE: { label: "O'rtacha yedi", tone: "sun" as const },
  POOR: { label: "Kam yedi", tone: "coral" as const },
};
const MOOD = {
  HAPPY: { label: "Xursand", tone: "sun" as const },
  NEUTRAL: { label: "Oddiy", tone: "sky" as const },
  UPSET: { label: "Xafa", tone: "coral" as const },
};

/** Panel sarlavhasidagi rangli nuqta — sinf nomini kesib olish o'rniga aniq xarita. */
const TONE_DOT: Record<string, string> = {
  mint: "bg-[var(--p-mint)]",
  sun: "bg-[var(--p-sun)]",
  coral: "bg-[var(--p-coral)]",
  sky: "bg-[var(--p-sky)]",
  lilac: "bg-[var(--p-lilac)]",
};

const TONE_BG: Record<string, string> = {
  mint: "bg-[var(--p-mint)]/12 text-[var(--p-mint)]",
  sun: "bg-[var(--p-sun)]/16 text-[#b07d00]",
  coral: "bg-[var(--p-coral)]/14 text-[var(--p-coral)]",
  sky: "bg-[var(--p-sky)]/14 text-[#2b7fb8]",
  lilac: "bg-[var(--p-lilac)]/14 text-[#7c5cd6]",
};

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return `${WEEKDAY[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

function sleepLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} daqiqa`;
  return m === 0 ? `${h} soat` : `${h} soat ${m} daqiqa`;
}

export default function ParentHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [activeChildId, setActiveChildId] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });

  // Seans yo'q bo'lsa kirish sahifasiga
  useEffect(() => {
    if (meQuery.isError && meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      router.replace(`/ota-ona/${slug}/kirish`);
    }
  }, [meQuery.isError, meQuery.error, router, slug]);

  const children = meQuery.data?.children ?? [];
  const childId = activeChildId ?? children[0]?.id ?? null;

  const dayQuery = useQuery({
    queryKey: ["parent-day", childId],
    queryFn: () => parentApi.get<ParentDay>(`/app/parent/children/${childId}/day`),
    enabled: !!childId,
  });

  const stripQuery = useQuery({
    queryKey: ["parent-strip", childId],
    queryFn: () => parentApi.get<ParentAttendanceStrip>(`/app/parent/children/${childId}/attendance`),
    enabled: !!childId,
  });

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--p-coral)] border-t-transparent" />
      </div>
    );
  }
  if (!meQuery.data) return null;

  const { parent } = meQuery.data;
  const child = children.find((c) => c.id === childId) ?? null;
  const day = dayQuery.data;
  const present = day?.attendance?.status === "PRESENT";
  const absent = day?.attendance?.status === "ABSENT";

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
        {/* Sarlavha. Chiqish tugmasi Sozlamalar bo'limida — ota-ona uni
            kunda bir marta ham bosmaydi, tepada turishi shart emas. */}
        <header className="min-w-0">
          <p className="truncate text-[17px] font-bold tracking-[-0.01em] text-[var(--p-ink)]">
            {parent.fullName}
          </p>
        </header>

        {/* Bir nechta bola bo'lsa — tanlash */}
        {children.length > 1 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {children.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveChildId(c.id)}
                className={clsx(
                  "shrink-0 cursor-pointer rounded-full px-4 py-2.5 text-[14px] font-semibold transition-colors",
                  c.id === childId
                    ? "bg-[var(--p-coral)] text-white"
                    : "bg-white/70 text-[var(--p-muted)]",
                )}
              >
                {c.fullName.split(" ").slice(-1)[0]}
              </button>
            ))}
          </div>
        )}

        {/* Bola kartochkasi */}
        {child && (
          <section className={`${styles.pop} ${styles.childCard} mt-5 rounded-[var(--p-radius)] p-5 shadow-[var(--p-shadow)]`}>
            <div className="flex items-center gap-4">
              <div className={styles.float}>
                {child.avatarUpdatedAt ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil
                  <img
                    src={`${PARENT_API_URL}/app/parent/children/${child.id}/avatar?v=${encodeURIComponent(child.avatarUpdatedAt)}`}
                    alt={child.fullName}
                    className="h-[72px] w-[72px] rounded-full object-cover ring-4 ring-[var(--p-sun)]/25"
                  />
                ) : (
                  <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[var(--p-sun)]/20 text-[22px] font-bold text-[#b07d00] ring-4 ring-[var(--p-sun)]/15">
                    {initials(child.fullName)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">
                  {child.fullName}
                </h1>
                <p className="mt-0.5 truncate text-[14px] text-[var(--p-muted)]">
                  {child.group?.name ?? "Guruhsiz"}
                </p>
                {day && <p className="mt-0.5 text-[13px] text-[var(--p-muted)]">{prettyDate(day.date)}</p>}
              </div>
            </div>

            {/* Bugun keldimi */}
            <div
              className={clsx(
                "mt-4 flex items-center gap-3 rounded-[18px] px-4 py-3.5",
                present ? "bg-[var(--p-mint)]/12" : absent ? "bg-[var(--p-coral)]/12" : "bg-black/[0.04]",
              )}
            >
              <span
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px] font-bold text-white",
                  present ? "bg-[var(--p-mint)]" : absent ? "bg-[var(--p-coral)]" : "bg-[var(--p-muted)]/50",
                )}
              >
                {present ? "✓" : absent ? "✕" : "?"}
              </span>
              <div>
                <p className="text-[16px] font-bold text-[var(--p-ink)]">
                  {present ? "Bugun bog'chada" : absent ? "Bugun kelmadi" : "Hali belgilanmagan"}
                </p>
                <p className="text-[13px] text-[var(--p-muted)]">
                  {present
                    ? "Tarbiyachi davomatni belgiladi"
                    : absent
                      ? day?.attendance?.note || "Sabab ko'rsatilmagan"
                      : "Tarbiyachi hali davomat qilmadi"}
                </p>
              </div>
            </div>

            {stripQuery.data && <AttendanceCalendar strip={stripQuery.data} />}
          </section>
        )}

        {/* Bugungi kun */}
        {dayQuery.isLoading ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[var(--p-radius)] bg-white/60" />
            ))}
          </div>
        ) : (
          day && (
            <div className="mt-4 space-y-3">
              {/* Kayfiyat, ovqat, uyqu */}
              <div className="grid grid-cols-3 gap-3">
                <MiniCard
                  label="Kayfiyat"
                  value={day.report?.mood ? MOOD[day.report.mood].label : "—"}
                  tone={day.report?.mood ? MOOD[day.report.mood].tone : "lilac"}
                />
                <MiniCard
                  label="Ovqat"
                  value={day.report?.eatingQuality ? EATING[day.report.eatingQuality].label.split(" ")[0] : "—"}
                  tone={day.report?.eatingQuality ? EATING[day.report.eatingQuality].tone : "lilac"}
                />
                <MiniCard
                  label="Uyqu"
                  value={day.report?.sleepMinutes != null ? sleepLabel(day.report.sleepMinutes) : "—"}
                  tone="sky"
                />
              </div>

              {/* Nima bilan shug'ullandi */}
              <Panel title="Bugun nima qildik" accent="lilac">
                {day.report?.activityNotes ? (
                  <p className="text-[15px] leading-relaxed text-[var(--p-ink)]">{day.report.activityNotes}</p>
                ) : (
                  <Empty text="Tarbiyachi hali yozmadi" />
                )}
              </Panel>

              {/* Ovqat menyusi */}
              <Panel title="Bugungi ovqat" accent="sun">
                {day.menu && (day.menu.breakfast || day.menu.lunch || day.menu.snack) ? (
                  <ul className="space-y-3">
                    <Meal label="Nonushta" value={day.menu.breakfast} />
                    <Meal label="Tushlik" value={day.menu.lunch} />
                    <Meal label="Kechki" value={day.menu.snack} />
                  </ul>
                ) : (
                  <Empty text="Bugungi menyu kiritilmagan" />
                )}
              </Panel>

              {day.report?.toiletNotes && (
                <Panel title="Qo'shimcha" accent="mint">
                  <p className="text-[15px] leading-relaxed text-[var(--p-ink)]">{day.report.toiletNotes}</p>
                </Panel>
              )}
            </div>
          )
        )}

      <p className="mt-8 text-center text-[13px] text-[var(--p-muted)]">
        Savolingiz bo&apos;lsa — tarbiyachi yoki bog&apos;cha ma&apos;muriyatiga murojaat qiling
      </p>
    </div>
  );
}

/**
 * Davomat — kalendar ko'rinishida.
 *
 * Ilgari bu yerda 14 ta bir xil ustun turardi: ota-ona ularning qaysi biri
 * qaysi kun ekanini bilolmasdi, shuning uchun ular hech nima aytmasdi.
 * Endi har bir katak o'z sanasi va hafta kuni ustunida turadi, ostida esa
 * oddiy so'z bilan yozilgan izoh bor.
 */
function AttendanceCalendar({ strip }: { strip: ParentAttendanceStrip }) {
  // Dushanbadan boshlanadigan hafta: birinchi kun o'z ustuniga tushishi
  // uchun oldiga bo'sh kataklar qo'yiladi.
  const firstDay = new Date(`${strip.items[0]?.date ?? ""}T00:00:00.000Z`);
  const lead = Number.isNaN(firstDay.getTime()) ? 0 : (firstDay.getUTCDay() + 6) % 7;
  const today = strip.items[strip.items.length - 1]?.date;

  // Yozuvi yo'q shanba-yakshanba "belgilanmagan" emas — bog'cha ishlamagan
  // kun. Ularni sanasak, tarbiyachi hisobotni unutgandek ko'rinardi.
  // Agar o'sha kunda davomat qilingan bo'lsa, demak bog'cha ishlagan:
  // unda katak ham, hisob ham odatdagidek.
  const isRestDay = (item: { date: string; status: string | null }) => {
    if (item.status) return false;
    const wd = new Date(`${item.date}T00:00:00.000Z`).getUTCDay();
    return wd === 0 || wd === 6;
  };
  const unmarked = strip.items.filter((item) => !item.status && !isRestDay(item)).length;

  return (
    <div className="mt-4 rounded-[18px] bg-white/70 px-4 py-3.5">
      <p className="text-[14px] font-bold text-[var(--p-ink)]">Oxirgi 2 hafta</p>

      {/* Avval son bilan javob: eng ko'p so'raladigan savol shu */}
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        <Tally count={strip.present} label="kun keldi" dot="bg-[var(--p-mint)]" />
        <Tally count={strip.absent} label="kun kelmadi" dot="bg-[var(--p-coral)]" />
        {unmarked > 0 && <Tally count={unmarked} label="kun belgilanmagan" dot="bg-black/15" />}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} className="text-center text-[11px] font-semibold text-[var(--p-muted)]">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {strip.items.map((item) => {
          const rest = isRestDay(item);
          return (
            <span
              key={item.date}
              title={`${prettyDate(item.date)} — ${
                item.status === "PRESENT"
                  ? "keldi"
                  : item.status === "ABSENT"
                    ? "kelmadi"
                    : rest
                      ? "dam olish kuni"
                      : "belgilanmagan"
              }`}
              className={clsx(
                "flex h-9 items-center justify-center rounded-[11px] text-[13px] font-bold tabular-nums",
                item.status === "PRESENT"
                  ? "bg-[var(--p-mint)] text-white"
                  : item.status === "ABSENT"
                    ? "bg-[var(--p-coral)] text-white"
                    : rest
                      ? "text-[var(--p-muted)]/45"
                      : "bg-black/[0.05] text-[var(--p-muted)]",
                // Bugungi kun ko'zga tashlanib tursin
                item.date === today && "ring-2 ring-[var(--p-ink)]/25 ring-offset-1 ring-offset-white",
              )}
            >
              {Number(item.date.slice(8, 10))}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Tally({ count, label, dot }: { count: number; label: string; dot: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[13.5px] text-[var(--p-muted)]">
      <span className={clsx("h-2.5 w-2.5 rounded-full", dot)} />
      <b className="text-[15px] font-bold text-[var(--p-ink)]">{count}</b> {label}
    </span>
  );
}

function MiniCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-[20px] bg-[var(--p-card)] p-3.5 text-center shadow-[var(--p-shadow)]">
      <span className={clsx("mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold", TONE_BG[tone])}>
        {label[0]}
      </span>
      <p className="mt-2 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">{label}</p>
      <p className="mt-0.5 text-[14px] font-bold leading-tight text-[var(--p-ink)]">{value}</p>
    </div>
  );
}

function Panel({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
      <div className="flex items-center gap-2.5 px-5 pt-4">
        <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", TONE_DOT[accent])} />
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[var(--p-ink)]">{title}</h2>
      </div>
      <div className="px-5 pb-5 pt-3">{children}</div>
    </section>
  );
}

function Meal({ label, value }: { label: string; value: string | null }) {
  return (
    <li>
      <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">{label}</p>
      <p className="mt-0.5 text-[15px] leading-relaxed text-[var(--p-ink)]">{value || "—"}</p>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[15px] text-[var(--p-muted)]">{text}</p>;
}
