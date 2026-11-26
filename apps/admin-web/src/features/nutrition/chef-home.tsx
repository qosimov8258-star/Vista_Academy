"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ChildAllergy, MenuEntry, MenuMeal, MenuPhoto } from "@/lib/types";
import { useAuth, useFeatureEnabled } from "@/lib/use-auth";
import { AlertIcon, CheckIcon, ChevronRightIcon } from "@/components/ui/icons";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { todayTashkent } from "@/features/desk/shared";
import { MealCard } from "@/features/chef/meal-card";
import { MealEditSheet, type CarriedMeal, type MealEditTarget } from "@/features/chef/meal-edit-sheet";
import { PhotoViewer } from "@/features/chef/photo-viewer";
import { stampLabel } from "@/features/chef/stamp";
import styles from "@/features/chef/chef.module.css";
import { MEALS, menuPhotosKey, useMenuPhotos } from "./use-menu-photos";
import { useTr } from "@/i18n/tr";
import { useWinter } from "@/components/winter/season-shell";
import { WinterHeroScene } from "@/components/winter/winter-hero";

interface GroupRow {
  groupId: string | null;
  name: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  sick: number;
  notMarked: number;
}

interface TodaySummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  sick: number;
  notMarked: number;
  mealCount: number;
  staff: { total: number; present: number; late: number; absent: number; notMarked: number };
  staffMealCount: number;
  totalMealCount: number;
  groups: GroupRow[];
}

const MENU_FIELD: Record<MenuMeal, "breakfast" | "lunch" | "snack"> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  SNACK: "snack",
};

const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}`;
}

/** "YYYY-MM-DD" ± kun */
function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Oldingi menyu qancha orqagacha qidiriladi (bayram, ta'til kunlari uchun zaxira bilan) */
const CARRY_LOOKBACK_DAYS = 14;

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Tashkent" }).format(new Date()));
  if (hour >= 5 && hour < 11) return "Xayrli tong";
  if (hour >= 11 && hour < 17) return "Xayrli kun";
  if (hour >= 17 && hour < 22) return "Xayrli kech";
  return "Xayrli tun";
}

/**
 * Oshpaz kabinetining bosh sahifasi. Telefon uchun qurilgan: eng muhimi —
 * bugun nechta porsiya — birinchi ekranda, katta raqam bilan; ostida uchala
 * ovqat alohida kartada (menyu + suratlar + kamera); keyin allergiyalar va
 * guruhlar. Davomat belgilangan sari raqamlar o'zi yangilanadi.
 */
export function ChefHome({ slug }: { slug: string }) {
  const tr = useTr();
  const { user } = useAuth();
  const branchId = user?.branchId ?? "";
  const today = todayTashkent();
  const isOn = useFeatureEnabled();
  // Porsiya, menyu va suratlar — «Ovqatlanish»; allergiyalar — «Sog'liq»
  const nutritionOn = isOn("nutrition");
  const healthOn = isOn("health");

  const todayQuery = useQuery({
    queryKey: ["menu-today-summary", slug, branchId, today],
    queryFn: () => api.get<TodaySummary>(`/app/menu/today-summary?branchId=${branchId}&date=${today}`),
    enabled: !!branchId && nutritionOn,
    refetchInterval: 15_000,
  });
  const menuQuery = useQuery({
    queryKey: ["menu", slug, branchId, today, "chef-home"],
    queryFn: () => api.get<MenuEntry[]>(`/app/menu?branchId=${branchId}&from=${today}&to=${today}`),
    enabled: !!branchId && nutritionOn,
    refetchInterval: 60_000,
  });
  const allergiesQuery = useQuery({
    queryKey: ["allergies", slug, branchId],
    queryFn: () => api.get<ChildAllergy[]>(`/app/health/allergies?branchId=${branchId}`),
    enabled: !!branchId && healthOn,
    refetchInterval: 60_000,
  });
  // Bo'sh filial — suratlar so'rovi yuborilmaydi
  const photos = useMenuPhotos(slug, nutritionOn ? branchId : "", today);
  const [viewing, setViewing] = useState<{ id: string; title: string; carried: boolean } | null>(null);
  const [editingMeal, setEditingMeal] = useState<MenuMeal | null>(null);

  // Oldingi kunning menyusi: bugun bo'sh qolgan qismlar uchun tayyor turadi —
  // oshpaz «Tahrirlash» orqali o'zgartirib (yoki o'zgartirmay) bugunga saqlaydi
  const yesterday = shiftDay(today, -1);
  const prevMenuQuery = useQuery({
    queryKey: ["menu", slug, branchId, "chef-carry", today],
    queryFn: () => api.get<MenuEntry[]>(`/app/menu?branchId=${branchId}&from=${shiftDay(today, -CARRY_LOOKBACK_DAYS)}&to=${yesterday}`),
    enabled: !!branchId && nutritionOn,
  });
  const sourceEntry =
    [...(prevMenuQuery.data ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find((e) => e.breakfast?.trim() || e.lunch?.trim() || e.snack?.trim()) ?? null;
  const sourceDate = sourceEntry?.date.slice(0, 10) ?? null;
  const sourcePhotosQuery = useQuery({
    queryKey: menuPhotosKey(slug, branchId, sourceDate ?? ""),
    queryFn: () => api.get<MenuPhoto[]>(`/app/menu/photos?branchId=${branchId}&date=${sourceDate}`),
    enabled: !!branchId && nutritionOn && !!sourceDate,
  });
  const carriedLabel = !sourceDate
    ? null
    : sourceDate === yesterday
      ? tr("Kechagi menyu")
      : tr("{0} menyusi", `${Number(sourceDate.slice(8, 10))}-${MONTHS[Number(sourceDate.slice(5, 7)) - 1]}`);

  const menu = menuQuery.data?.find((e) => e.date.slice(0, 10) === today) ?? null;
  const firstName = user?.fullName?.trim().split(/\s+/).slice(-1)[0];

  /** Ovqat bo'yicha: bugungi matn/rasmlar va bugun bo'sh qism uchun oldingi kundagisi */
  const mealState = (meal: MenuMeal) => {
    const todayText = menu?.[MENU_FIELD[meal]]?.trim() || null;
    const todayPhotos = photos.photosOf(meal);
    const prevText = sourceEntry?.[MENU_FIELD[meal]]?.trim() || null;
    const prevPhotos = (sourcePhotosQuery.data ?? []).filter((p) => p.meal === meal);
    const carriedText = !todayText ? prevText : null;
    const carriedPhotos = todayPhotos.length === 0 ? prevPhotos : [];
    const carried: CarriedMeal | null =
      carriedLabel && (carriedText || carriedPhotos.length > 0) ? { label: carriedLabel, text: carriedText, photos: carriedPhotos } : null;
    // Ko'rsatilayotgan matn qachon saqlangan: bugungisi — bugungi yozuvdan, aks holda oldingi kunnikidan
    const savedAt = todayText ? (menu?.updatedAt ?? null) : carriedText ? (sourceEntry?.updatedAt ?? null) : null;
    return { todayText, todayPhotos, carried, savedAt };
  };
  const editTarget: MealEditTarget | null = (() => {
    if (!editingMeal) return null;
    const meta = MEALS.find((m) => m.meal === editingMeal);
    return { meal: editingMeal, label: meta?.label ?? "", ...mealState(editingMeal) };
  })();

  if (nutritionOn && todayQuery.isLoading) return <LoadingState rows={4} />;
  if (nutritionOn && todayQuery.isError) return <ErrorState message={tr((todayQuery.error as Error).message)} />;
  const d = todayQuery.data;
  if (nutritionOn && !d) return null;

  const header = (
    <header>
      <p className="text-[13px] font-medium text-[var(--color-text-muted)]">
        {dateLabel(today)}
        {user?.branchName ? ` · ${user.branchName}` : ""}
      </p>
      <h1 className="mt-0.5 text-[24px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
        {greeting()}
        {firstName ? `, ${firstName}` : ""}!
      </h1>
    </header>
  );

  // «Ovqatlanish» o'chirilgan — faqat salom va (bo'lsa) allergiyalar
  if (!nutritionOn || !d) {
    return (
      <div className="mx-auto max-w-[640px] space-y-5">
        {header}
        {healthOn && <AllergiesCard allergies={allergiesQuery.data ?? []} loading={allergiesQuery.isLoading} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      {header}

      {/* grid-cols-1 = minmax(0,1fr): ustun ekrandan kengaymaydi — keng surat tasmasi o'z ichida aylanadi */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-5">
          <PortionsHero d={d} />

          <section>
            <div className="mb-2.5 flex items-end justify-between gap-3">
              {/* Menyu qaysi kunniki: telefonda sarlavha ostida, kattaroq ekranda — «Bugungi taomlar · 22-noyabr» */}
              <h2 className="min-w-0 text-[17px] font-semibold text-[var(--color-text)]">
                {tr("Bugungi taomlar")}
                <span className="block text-[13.5px] font-medium text-[var(--color-text-muted)] sm:inline sm:text-[17px]">
                  <span className="max-sm:hidden">{" · "}</span>
                  {`${Number(today.slice(8, 10))}-${tr(MONTHS[Number(today.slice(5, 7)) - 1])}`}
                </span>
              </h2>
              <Link
                href={`/${slug}/nutrition`}
                className="flex shrink-0 items-center gap-0.5 text-[13.5px] font-semibold text-orange-600 active:opacity-70"
              >
                {tr("Haftalik menyu")}
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {MEALS.map(({ meal, label }) => {
                const state = mealState(meal);
                const photosCarried = state.todayPhotos.length === 0 && (state.carried?.photos.length ?? 0) > 0;
                const textCarried = !state.todayText && !!state.carried?.text;
                const shownPhotos = photosCarried ? (state.carried?.photos ?? []) : state.todayPhotos;
                return (
                  <MealCard
                    key={meal}
                    meal={meal}
                    label={tr(label)}
                    dishes={state.todayText ?? state.carried?.text ?? null}
                    photos={shownPhotos}
                    uploading={photos.uploading === meal}
                    error={photos.errors[meal]}
                    onFile={(file) => void photos.upload(meal, file)}
                    onOpenPhoto={(id) => {
                      const taken = shownPhotos.find((p) => p.id === id)?.createdAt;
                      setViewing({ id, title: taken ? `${tr(label)} · ${stampLabel(taken, today, tr)}` : tr(label), carried: photosCarried });
                    }}
                    carriedLabel={state.carried?.label ?? null}
                    textCarried={textCarried}
                    photosCarried={photosCarried}
                    onEdit={() => setEditingMeal(meal)}
                    savedAt={state.savedAt}
                    today={today}
                  />
                );
              })}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          {healthOn && <AllergiesCard allergies={allergiesQuery.data ?? []} loading={allergiesQuery.isLoading} />}
          <GroupsCard groups={d.groups} />
        </div>
      </div>

      <PhotoViewer
        photoId={viewing?.id ?? null}
        title={viewing?.title ?? ""}
        onClose={() => setViewing(null)}
        deleting={photos.remove.isPending}
        // Oldingi kun rasmi bu yerdan o'chirilmaydi — u o'sha kunning tarixi
        onDelete={viewing?.carried ? undefined : (id) => photos.remove.mutate(id, { onSuccess: () => setViewing(null) })}
      />

      <MealEditSheet slug={slug} branchId={branchId} date={today} target={editTarget} onClose={() => setEditingMeal(null)} />
    </div>
  );
}

/** Asosiy raqam: bugun nechta porsiya — bolalar va xodimlar alohida */
function PortionsHero({ d }: { d: TodaySummary }) {
  const tr = useTr();
  const childMarked = d.total - d.notMarked;
  const staffMarked = d.staff.total - d.staff.notMarked;
  const complete = d.notMarked === 0 && d.staff.notMarked === 0;
  const people = d.total + d.staff.total;
  const progress = people > 0 ? (childMarked + staffMarked) / people : 0;
  // Qishda kartada shimol yog'dusi, pastda qorli archalar
  const winter = useWinter();

  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-[26px] bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 p-5 text-white shadow-[0_18px_40px_-20px_rgba(234,88,12,0.7)]",
        winter && "pb-12",
      )}
    >
      {/* Yorqin to'q sariq kartada yog'du matnni xiralashtiradi — faqat archalar */}
      {winter && <WinterHeroScene aurora={false} />}
      {/* Bezak doiralar */}
      <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15" aria-hidden />
      <span className="pointer-events-none absolute -bottom-16 right-16 h-36 w-36 rounded-full bg-white/10" aria-hidden />

      <div className="relative flex items-center justify-between">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-white/85">{tr("Bugun tayyorlanadi")}</p>
        <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11.5px] font-semibold">
          <span className={clsx("h-1.5 w-1.5 rounded-full bg-white", styles.liveDot)} aria-hidden />
          {tr("Jonli")}
        </span>
      </div>

      <div className="relative mt-2 flex items-end gap-2">
        <span className="text-[64px] font-bold leading-[0.9] tabular-nums tracking-tight">{tr(d.totalMealCount)}</span>
        <span className="mb-1.5 text-[17px] font-semibold text-white/90">{tr("porsiya")}</span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2.5">
        <HeroChip label={tr("Bolalar")} value={d.mealCount} note={`${childMarked}/${d.total} belgilandi`} />
        <HeroChip label={tr("Xodimlar")} value={d.staffMealCount} note={`${staffMarked}/${d.staff.total} belgilandi`} />
      </div>

      <div className="relative mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-700 ease-[var(--ease-out)]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-[12.5px] font-medium text-white/90">
          {complete
            ? tr("Davomat to'liq belgilangan — raqam aniq")
            : tr("Davomat hali to'liq emas — belgilangan sari raqam o'zi yangilanadi")}
        </p>
      </div>
    </section>
  );
}

function HeroChip({ label, value, note }: { label: string; value: number; note: string }) {
  const tr = useTr();
  return (
    <div className="rounded-2xl bg-white/20 px-3.5 py-2.5 backdrop-blur-sm">
      <p className="text-[12px] font-medium text-white/85">{tr(label)}</p>
      <p className="text-[24px] font-bold leading-tight tabular-nums">{tr(value)}</p>
      <p className="text-[11.5px] text-white/80">{tr(note)}</p>
    </div>
  );
}

/** Allergiyasi bor bolalar — oshpaz uchun eng xavfli ma'lumot, qizil urg'u bilan */
function AllergiesCard({ allergies, loading }: { allergies: ChildAllergy[]; loading: boolean }) {
  const tr = useTr();
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 4;
  const shown = expanded ? allergies : allergies.slice(0, LIMIT);

  // Allergiya yo'q bo'lsa — qizil "xavf" emas, tinch tasdiq
  if (!loading && allergies.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-[22px] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-card)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <CheckIcon className="h-[18px] w-[18px]" />
        </span>
        <span>
          <span className="block text-[15px] font-semibold text-[var(--color-text)]">{tr("Allergiyasi bor bola yo'q")}</span>
          <span className="block text-[12.5px] text-[var(--color-text-muted)]">{tr("Bugungi menyuni bemalol tayyorlash mumkin")}</span>
        </span>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[22px] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5 bg-red-50 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <AlertIcon className="h-[18px] w-[18px]" />
        </span>
        <h2 className="flex-1 text-[15px] font-semibold text-red-700">{tr("Allergiyasi bor bolalar")}</h2>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[12.5px] font-bold tabular-nums text-red-700">{tr(allergies.length)}</span>
      </div>
      {loading ? (
        <div className="p-4">
          <LoadingState rows={2} />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-[var(--color-separator)]">
            {shown.map((a) => (
              <li key={a.child.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-sunken)] text-[13px] font-semibold text-[var(--color-text-muted)]">
                  {a.child.fullName.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-[var(--color-text)]">{tr(a.child.fullName)}</span>
                  <span className="block text-[12.5px] text-[var(--color-text-muted)]">{a.child.group?.name ?? "Guruhsiz"}</span>
                </span>
                <span className="max-w-[45%] rounded-xl bg-red-50 px-2.5 py-1 text-right text-[13px] font-semibold leading-snug text-red-600">
                  {tr(a.allergies)}
                </span>
              </li>
            ))}
          </ul>
          {allergies.length > LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full border-t border-[var(--color-separator)] py-3 text-[13.5px] font-semibold text-red-600 active:bg-red-50"
            >
              {expanded ? tr("Yig'ish") : tr("Yana {0} ta bola", allergies.length - LIMIT)}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Guruhlar bo'yicha kelganlar — qaysi guruh hali davomat qilmaganini ko'rsatadi */
function GroupsCard({ groups }: { groups: GroupRow[] }) {
  const tr = useTr();
  return (
    <section className="rounded-[22px] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Guruhlar bo'yicha")}</h2>
      <ul className="mt-3 space-y-3.5">
        {groups.filter((g) => g.total > 0).map((g) => {
          const came = g.present + g.late;
          const unmarked = g.total > 0 && g.notMarked === g.total;
          return (
            <li key={g.groupId ?? "none"}>
              <div className="flex items-baseline justify-between gap-2 text-[14px]">
                <span className="truncate font-medium text-[var(--color-text)]">{tr(g.name)}</span>
                {unmarked ? (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11.5px] font-semibold text-amber-600">
                    {tr("davomat qilinmagan")}
                  </span>
                ) : (
                  <span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">
                    <b className="text-[var(--color-text)]">{tr(came)}</b> / {tr(g.total)}
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                <div
                  className="h-full rounded-full bg-orange-400 transition-[width] duration-700 ease-[var(--ease-out)]"
                  style={{ width: g.total > 0 ? `${(came / g.total) * 100}%` : "0%" }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
