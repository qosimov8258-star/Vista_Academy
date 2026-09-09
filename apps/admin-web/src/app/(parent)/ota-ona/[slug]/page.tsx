"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ApiError } from "@/lib/api";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentAttendanceStrip, ParentChild, ParentDay } from "@/lib/types";
import { initials } from "@/components/ui/avatar";
import { LogoutIcon } from "@/components/ui/icons";
import styles from "./parent.module.css";

const WEEKDAY = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];
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

  const logout = async () => {
    await parentApi.post("/app/parent/logout").catch(() => undefined);
    router.replace(`/ota-ona/${slug}/kirish`);
  };

  if (meQuery.isLoading) {
    return (
      <div className={`${styles.shell} ${styles.sky} flex min-h-[100dvh] items-center justify-center`}>
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--p-coral)] border-t-transparent" />
      </div>
    );
  }
  if (!meQuery.data) return <div className={styles.shell} />;

  const { parent } = meQuery.data;
  const child = children.find((c) => c.id === childId) ?? null;
  const day = dayQuery.data;
  const present = day?.attendance?.status === "PRESENT";
  const absent = day?.attendance?.status === "ABSENT";

  return (
    <div className={`${styles.shell} ${styles.sky} min-h-[100dvh] pb-10`}>
      <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
        {/* Sarlavha */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--p-muted)]">
              {parent.organizationName}
            </p>
            <p className="truncate text-[15px] font-semibold text-[var(--p-ink)]">{parent.fullName}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Chiqish"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/70 text-[var(--p-muted)] shadow-[var(--p-shadow)] transition-colors active:bg-white"
          >
            <LogoutIcon className="h-5 w-5" />
          </button>
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
          <section className={`${styles.pop} mt-5 rounded-[var(--p-radius)] bg-[var(--p-card)] p-5 shadow-[var(--p-shadow)]`}>
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

            {/* Oxirgi 2 hafta */}
            {stripQuery.data && (
              <div className="mt-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-[13px] font-semibold text-[var(--p-muted)]">Oxirgi 2 hafta</p>
                  <p className="text-[13px] text-[var(--p-muted)]">
                    <b className="text-[var(--p-mint)]">{stripQuery.data.present}</b> kun keldi
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {stripQuery.data.items.map((item) => (
                    <span
                      key={item.date}
                      title={prettyDate(item.date)}
                      className={clsx(
                        "h-7 flex-1 rounded-[7px]",
                        item.status === "PRESENT"
                          ? "bg-[var(--p-mint)]"
                          : item.status === "ABSENT"
                            ? "bg-[var(--p-coral)]/70"
                            : "bg-black/[0.06]",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
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
    </div>
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
