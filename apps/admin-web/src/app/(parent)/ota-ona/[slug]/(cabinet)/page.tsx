"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowLeftRight,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  ImagePlus,
  Moon,
  ReceiptText,
  Smile,
  Soup,
  StickyNote,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import type {
  ParentAccount,
  ParentAttendanceStrip,
  ParentChild,
  ParentDay,
  ParentPaymentReceipt,
  ParentPaymentReminder,
} from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { prepareReceiptPhoto } from "@/lib/receipt-photo";
import { initials } from "@/components/ui/avatar";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";
import styles from "../parent.module.css";
import { GroupLine } from "./group-line";
import { NotifyTeacher } from "./notify-teacher";
import { useSelectedChild } from "./use-selected-child";
import { useParentMessages } from "./use-messages";
import { useParentFeatures } from "./use-parent-features";
import { FoydaliCards } from "./foydali-cards";
import { useTr } from "@/i18n/tr";

/**
 * Ota-ona kabinetining bosh sahifasi — iOS «soft UI» uslubida (egasining
 * qarori, 2026-11-16): oq fon, yumshoq soyali oq kartalar, iOS Sozlamalaridagi
 * kabi rangli plitkali belgilar (IosIcon), tizim ranglari. Sahifa doim yorug'
 * (qarang: theme.tsx) — shuning uchun bu yerda ranglar to'g'ridan-to'g'ri
 * iOS qiymatlari bilan yoziladi.
 *
 * Tartib: sarlavha → yangi xabar → bola va bugungi holat → davomat →
 * tarbiyachiga xabar → to'lov → bugungi kun → Foydali.
 */

const WEEKDAY = ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"];
const WEEKDAY_FULL = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
/** Kalendar ustunlari — hafta dushanbadan boshlanadi */
const WEEKDAY_SHORT = ["Du", "Se", "Cho", "Pay", "Ju", "Sha", "Yak"];
const MONTH = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const EATING = { GOOD: "Yaxshi", AVERAGE: "O'rtacha", POOR: "Kam" } as const;
const MOOD = { HAPPY: "Xursand", NEUTRAL: "Oddiy", UPSET: "Xafa" } as const;

/** iOS tizim ranglari — shu sahifada ko'p ishlatiladiganlari */
const GREEN = "#34c759";
const RED = "#ff3b30";
const ORANGE = "#ff9500";

const CARD = "rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]";

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
  const tr = useTr();
  const { slug } = use(params);
  const router = useRouter();
  // Bog'cha yuborgan yangi xabarlar — bosh sahifada eslatma
  // Platforma o'chirgan funksiyalarga so'rov yuborilmaydi — bo'limlar shunchaki ko'rinmaydi
  const { ready: featuresReady, isOn } = useParentFeatures(slug);
  const messagesQuery = useParentMessages(slug, featuresReady && isOn("notifications"));
  const newMessages = messagesQuery.data?.filter((m) => !m.readAt) ?? [];
  const queryClient = useQueryClient();
  const [reasonDraft, setReasonDraft] = useState("");

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

  const { child, childId, multiple } = useSelectedChild(slug, meQuery.data?.children);

  const dayQuery = useQuery({
    queryKey: ["parent-day", childId],
    queryFn: () => parentApi.get<ParentDay>(`/app/parent/children/${childId}/day`),
    enabled: !!childId,
  });

  const stripQuery = useQuery({
    queryKey: ["parent-strip", childId],
    queryFn: () => parentApi.get<ParentAttendanceStrip>(`/app/parent/children/${childId}/attendance`),
    enabled: !!childId && featuresReady && isOn("attendance"),
  });

  const reminderQuery = useQuery({
    queryKey: ["parent-payment-reminder", childId],
    queryFn: () => parentApi.get<ParentPaymentReminder>(`/app/parent/children/${childId}/payment-reminder`),
    // Eslatma «To'lov eslatmalari»ga ham kiradi — o'chirilgan bo'lsa API 403 beradi
    enabled: !!childId && featuresReady && isOn("billing") && isOn("paymentReminders"),
  });

  const receiptsQuery = useQuery({
    queryKey: ["parent-payment-receipts", childId],
    queryFn: () => parentApi.get<ParentPaymentReceipt[]>(`/app/parent/children/${childId}/payment-receipts`),
    enabled: !!childId && featuresReady && isOn("paymentReceipts"),
    retry: false,
  });

  // Kelmagan kun uchun sababni ota-ona shu yerdan yozadi — tarbiyachi buni
  // ko'rgach "Aloqaga chiqish"ni bosishga hojat qolmaydi.
  const reasonMutation = useMutation({
    mutationFn: (reason: string) =>
      parentApi.post(`/app/parent/children/${childId}/attendance/${dayQuery.data?.date}/reason`, { reason }),
    onSuccess: () => {
      setReasonDraft("");
      queryClient.invalidateQueries({ queryKey: ["parent-day", childId] });
    },
  });

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#007aff] border-t-transparent" />
      </div>
    );
  }
  if (!meQuery.data) return null;

  const { parent } = meQuery.data;
  const day = dayQuery.data;
  const present = day?.attendance?.status === "PRESENT";
  const absent = day?.attendance?.status === "ABSENT";
  // O'chirilgan funksiyalarning bloklari ko'rinmaydi (API ham ularni null qaytaradi)
  const attendanceOn = isOn("attendance");
  const reportsOn = isOn("dailyReports");
  const nutritionOn = isOn("nutrition");

  // Sana: server bergan kun (filial vaqti), u kelmaguncha — qurilma sanasi
  const todayIso = day?.date ?? new Date().toLocaleDateString("en-CA");
  const todayDate = new Date(`${todayIso}T00:00:00.000Z`);
  const longDate = `${tr(WEEKDAY_FULL[todayDate.getUTCDay()])}, ${todayDate.getUTCDate()}-${tr(MONTH[todayDate.getUTCMonth()])}`;

  const status = present
    ? { icon: Check, tint: "green" as const, bg: "rgba(52,199,89,0.1)", title: tr("Bugun bog'chada") }
    : absent
      ? { icon: X, tint: "red" as const, bg: "rgba(255,59,48,0.08)", title: tr("Bugun kelmadi") }
      : { icon: Clock3, tint: "gray" as const, bg: "var(--p-sunken)", title: tr("Hali belgilanmagan") };
  const statusNote = present
    ? day?.attendance?.checkInTime
      ? // Yuz tanish terminali yozgan vaqt
        `${day.attendance.checkInTime} da keldi${day.attendance.checkOutTime ? ` · ${day.attendance.checkOutTime} da ketdi` : ""}`
      : tr("Tarbiyachi davomatni belgiladi")
    : absent
      ? day?.attendance?.parentReason || day?.attendance?.note || tr("Sabab ko'rsatilmagan")
      : tr("Tarbiyachi hali davomat qilmadi");

  return (
    <div className={`${styles.iosHome} mx-auto w-full max-w-[520px] px-4 pt-6`}>
      {/* Sarlavha — iOS «katta sarlavha»: tepada sana, ostida ism; o'ngda xabarlar.
          Chiqish tugmasi Sozlamalar bo'limida. */}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">{longDate}</p>
          <p className="mt-0.5 truncate text-[30px] font-bold leading-tight tracking-[-0.025em] text-[var(--p-ink)]">
            {tr(parent.fullName)}
          </p>
        </div>
        {featuresReady && isOn("notifications") && (
          <Link
            href={`/ota-ona/${slug}/xabarlar`}
            aria-label={newMessages.length > 0 ? tr("{0} ta yangi xabar", newMessages.length) : tr("Xabarlar")}
            className="relative mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--p-card)] text-[var(--p-ink)] shadow-[var(--p-shadow)] transition-transform active:scale-95"
          >
            <Bell className="h-[21px] w-[21px]" strokeWidth={2} />
            {newMessages.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[11.5px] font-bold tabular-nums text-white ring-2 ring-white">
                {newMessages.length > 9 ? "9+" : newMessages.length}
              </span>
            )}
          </Link>
        )}
      </header>

      {/* Yangi xabar — iOS bildirishnomasi ko'rinishida */}
      {newMessages.length > 0 && (
        <Link
          href={`/ota-ona/${slug}/xabarlar`}
          className={`${CARD} mt-5 flex items-start gap-3 p-3.5 transition-transform active:scale-[0.99]`}
        >
          <IosIcon icon={Bell} tint="red" size={40} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[15.5px] font-semibold text-[var(--p-ink)]">
                {newMessages.length === 1 ? newMessages[0].title : tr("{0} ta yangi xabar", newMessages.length)}
              </span>
              <span className="shrink-0 text-[12.5px] text-[var(--p-muted)]">{tr("Yangi")}</span>
            </span>
            <span className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-[var(--p-muted)]">
              {newMessages.length === 1 ? newMessages[0].body : tr("Bog'chadan xabar keldi — o'qish uchun bosing")}
            </span>
          </span>
        </Link>
      )}

      {/* Bola va bugungi holat */}
      {child && (
        <section className={`${styles.pop} ${CARD} mt-5 p-4`}>
          <div className="flex items-center gap-3.5">
            {child.avatarUpdatedAt ? (
              // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil
              <img
                src={`${PARENT_API_URL}/app/parent/children/${child.id}/avatar?v=${encodeURIComponent(child.avatarUpdatedAt)}`}
                alt={tr(child.fullName)}
                className="h-[60px] w-[60px] shrink-0 rounded-full bg-[var(--p-sunken)] object-cover"
              />
            ) : (
              <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-[#007aff]/12 text-[20px] font-semibold text-[#007aff]">
                {initials(child.fullName)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[20px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">
                {tr(child.fullName)}
              </h1>
              <GroupLine child={child} size={20} className="mt-1 text-[14.5px] text-[var(--p-muted)]" />
            </div>
            {/* Bir nechta farzand bo'lsa — almashtirish */}
            {multiple && (
              <Link
                href={`/ota-ona/${slug}/tanlash`}
                aria-label={tr("Farzandni almashtirish")}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--p-sunken)] px-3 text-[13.5px] font-semibold text-[#007aff] transition-transform active:scale-95"
              >
                <ArrowLeftRight className="h-4 w-4" strokeWidth={2.2} />
                <span className="max-[359px]:hidden">{tr("Almashtirish")}</span>
              </Link>
            )}
          </div>

          {/* Bugun keldimi */}
          {attendanceOn && (
            <div className="mt-4 flex items-center gap-3 rounded-[18px] p-3" style={{ background: status.bg }}>
              <IosIcon icon={status.icon} tint={status.tint} size={40} />
              <div className="min-w-0">
                <p className="text-[16px] font-semibold leading-snug text-[var(--p-ink)]">{status.title}</p>
                <p className="text-[13.5px] leading-snug text-[var(--p-muted)]">{statusNote}</p>
              </div>
            </div>
          )}

          {/* Kelmagan kun uchun sabab — bir marta yozilgach o'zgartirilmaydi,
              tarbiyachi buni ko'radi va aloqaga chiqishga hojat qolmaydi. */}
          {attendanceOn && absent && !day?.attendance?.parentReason && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const reason = reasonDraft.trim();
                if (reason) reasonMutation.mutate(reason);
              }}
              className="mt-3.5"
            >
              <label htmlFor="absence-reason" className="block px-1 text-[13px] font-medium text-[var(--p-muted)]">
                {tr("Nega kelmadi? Sababini yozing")}
              </label>
              <textarea
                id="absence-reason"
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                rows={2}
                placeholder={tr("Masalan: shifokorga bordik")}
                className="mt-1.5 w-full resize-none rounded-[14px] bg-[var(--p-sunken)] px-3.5 py-2.5 text-[16px] text-[var(--p-ink)] outline-none placeholder:text-[var(--p-muted)] focus:ring-2 focus:ring-[#007aff]/40"
              />
              <button
                type="submit"
                disabled={!reasonDraft.trim() || reasonMutation.isPending}
                className="mt-2 h-11 w-full rounded-full bg-[#007aff] text-[15.5px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                {reasonMutation.isPending ? tr("Yuborilmoqda...") : tr("Yuborish")}
              </button>
              {reasonMutation.isError && (
                <p className="mt-2 px-1 text-[13px] text-[#ff3b30]">{tr("Yuborib bo'lmadi — qayta urinib ko'ring")}</p>
              )}
            </form>
          )}
        </section>
      )}

      {/* Davomat — oxirgi 2 hafta */}
      {attendanceOn && stripQuery.data && <AttendanceCard strip={stripQuery.data} />}

      {/* Xabar tarbiyachiga xodim bildirishnomasi bo'lib boradi — u o'chiq bo'lsa blok ham yo'q */}
      {childId && isOn("employeeNotifications") && <NotifyTeacher childId={childId} departureEnabled={isOn("pickups")} />}

      {/* To'lov eslatmasi — bog'cha sozlagan kunlar oynasida to'lanmagan
          hisob-faktura bo'lsa chiqadi, to'lov qilingach o'zi yo'qoladi.
          «To'lov cheklari» o'chirilgan bo'lsa To'lov sahifasi yo'q — tugma ham yo'q */}
      {reminderQuery.data?.visible && (
        <PaymentReminderCard reminder={reminderQuery.data} payHref={isOn("paymentReceipts") ? `/ota-ona/${slug}/tolov` : undefined} />
      )}

      {/* Chek yuklash — faqat to'lov kutilayotganda ochiladi (aks holda
          tasdiqlash uchun ochiq hisob-faktura topilmaydi). Oldingi
          cheklarning holati esa har doim ko'rinadi. */}
      {childId && isOn("paymentReceipts") && (reminderQuery.data?.visible || (receiptsQuery.data && receiptsQuery.data.length > 0)) && (
        <PaymentReceiptSection childId={childId} canSubmit={!!reminderQuery.data?.visible} receipts={receiptsQuery.data ?? []} />
      )}

      {/* Bugungi kun */}
      {dayQuery.isLoading ? (
        <div className="mt-8">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[112px] animate-pulse rounded-[var(--p-radius)] bg-[var(--p-sunken)] motion-reduce:animate-none" />
            ))}
          </div>
          <div className="mt-3 h-[76px] animate-pulse rounded-[var(--p-radius)] bg-[var(--p-sunken)] motion-reduce:animate-none" />
        </div>
      ) : (
        day &&
        (reportsOn || nutritionOn) && (
          <section className="mt-8">
            <SectionTitle>{tr("Bugun")}</SectionTitle>

            {/* Kayfiyat, ovqat, uyqu — vidjetlar */}
            {reportsOn && (
              <div className="grid grid-cols-3 gap-3">
                <Widget icon={Smile} tint="pink" label={tr("Kayfiyat")} value={day.report?.mood ? tr(MOOD[day.report.mood]) : "—"} />
                <Widget
                  icon={Utensils}
                  tint="orange"
                  label={tr("Ovqat")}
                  value={day.report?.eatingQuality ? tr(EATING[day.report.eatingQuality]) : "—"}
                />
                <Widget
                  icon={Moon}
                  tint="indigo"
                  label={tr("Uyqu")}
                  value={day.report?.sleepMinutes != null ? tr(sleepLabel(day.report.sleepMinutes)) : "—"}
                />
              </div>
            )}

            {/* «Bugun nima qildik» (tarbiyachining uzun yozuvi) — Kundalik bo'limida.
                Ovqat tartibi ham to'liq o'sha yerda; bu yerda qisqacha va havola
                («Kundalik» o'chirilgan bo'lsa havolasiz). */}
            {nutritionOn && <TodayMealsRow slug={slug} day={day} linked={isOn("diary")} className={reportsOn ? "mt-3" : undefined} />}

            {reportsOn && day.report?.toiletNotes && (
              <div className={`${CARD} mt-3 flex items-start gap-3 p-4`}>
                <IosIcon icon={StickyNote} tint="teal" size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold text-[var(--p-ink)]">{tr("Qo'shimcha")}</p>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-[var(--p-ink)]/80">{tr(day.report.toiletNotes)}</p>
                </div>
              </div>
            )}
          </section>
        )
      )}

      {/* Maqolalar, o'yinlar, galereya — platforma o'chirganlari chiqmaydi */}
      {featuresReady && (
        <FoydaliCards slug={slug} articlesOn={isOn("articles")} galleryOn={isOn("gallery")} />
      )}

      <p className="mt-9 px-6 text-center text-[13px] leading-relaxed text-[var(--p-muted)]">
        {tr("Savolingiz bo'lsa — tarbiyachi yoki bog'cha ma'muriyatiga murojaat qiling")}
      </p>
    </div>
  );
}

/** Bo'lim sarlavhasi — kartadan tashqarida, iOS'dagi kabi yirik va qalin */
function SectionTitle({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">{children}</h2>
      {trailing && <span className="shrink-0 text-[14px] text-[var(--p-muted)]">{trailing}</span>}
    </div>
  );
}

/** Kichik vidjet: plitka belgi, nomi va qiymati — «Salomatlik» ilovasidagi kabi */
function Widget({ icon, tint, label, value }: { icon: AnyIcon; tint: IosTint; label: string; value: string }) {
  return (
    <div className={`${CARD} p-3.5`}>
      <IosIcon icon={icon} tint={tint} size={32} />
      <p className="mt-3 truncate text-[13px] font-medium text-[var(--p-muted)]">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold leading-tight text-[var(--p-ink)] [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

/**
 * Davomat — oxirgi 2 hafta.
 *
 * Avval son bilan javob (eng ko'p so'raladigan savol shu), keyin kalendar:
 * har bir kun o'z hafta kuni ustunida, doiracha rangi — holati.
 */
function AttendanceCard({ strip }: { strip: ParentAttendanceStrip }) {
  const tr = useTr();
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
  const stats = [
    { count: strip.present, label: "Keldi", color: GREEN },
    { count: strip.absent, label: "Kelmadi", color: RED },
    ...(unmarked > 0 ? [{ count: unmarked, label: "Belgilanmagan", color: "#8e8e93" }] : []),
  ];

  return (
    <section className="mt-8">
      <SectionTitle trailing={tr("Oxirgi 2 hafta")}>{tr("Davomat")}</SectionTitle>
      <div className={`${CARD} p-4`}>
        {/* Sonlar — ingichka chiziq bilan ajratilgan */}
        <div className="flex divide-x divide-[var(--p-line)]">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0 flex-1 px-2 text-center first:pl-0 last:pr-0">
              <p className="text-[26px] font-bold leading-none tabular-nums" style={{ color: stat.color }}>
                {stat.count}
              </p>
              <p className="mt-1.5 truncate text-[12.5px] text-[var(--p-muted)]">{tr(stat.label)}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-7 gap-y-1.5 border-t border-[var(--p-line)] pt-3.5">
          {WEEKDAY_SHORT.map((d) => (
            <span key={d} className="pb-0.5 text-center text-[12px] font-medium text-[var(--p-muted)]">
              {tr(d)}
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
                  item.status === "PRESENT" ? "keldi" : item.status === "ABSENT" ? "kelmadi" : rest ? "dam olish kuni" : "belgilanmagan"
                }`}
                className={clsx(
                  "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold tabular-nums",
                  item.status === "PRESENT"
                    ? "bg-[#34c759] text-white"
                    : item.status === "ABSENT"
                      ? "bg-[#ff3b30] text-white"
                      : rest
                        ? "text-[#c7c7cc]"
                        : "bg-[var(--p-sunken)] text-[var(--p-muted)]",
                  // Bugungi kun — ko'k halqa
                  item.date === today && "ring-2 ring-[#007aff] ring-offset-2 ring-offset-white",
                )}
              >
                {Number(item.date.slice(8, 10))}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Bugungi ovqat — qisqacha; bosilsa Kundalik'dagi to'liq ovqat tartibiga o'tadi */
function TodayMealsRow({ slug, day, linked, className }: { slug: string; day: ParentDay; linked: boolean; className?: string }) {
  const tr = useTr();
  const photos = day.menuPhotos ?? [];
  const main = day.menu?.lunch || day.menu?.breakfast || day.menu?.snack || null;
  const firstPhoto = photos[0];
  const body = (
    <>
      {firstPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${PARENT_API_URL}/app/parent/children/${day.child.id}/menu-photos/${firstPhoto.id}`}
          alt={tr("Bugungi ovqat")}
          className="h-11 w-11 shrink-0 rounded-[12px] bg-[var(--p-sunken)] object-cover"
        />
      ) : (
        <IosIcon icon={Soup} tint="orange" size={40} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold leading-snug text-[var(--p-ink)]">{tr("Bugungi ovqat tartibi")}</span>
        <span className="block truncate text-[13.5px] text-[var(--p-muted)]">
          {main ?? tr("Menyu hali kiritilmagan")}
          {photos.length > 0 ? tr(" · {0} ta surat", photos.length) : ""}
        </span>
      </span>
      {linked && <ChevronRight className="h-5 w-5 shrink-0 text-[#c7c7cc]" strokeWidth={2.4} aria-hidden="true" />}
    </>
  );
  const rowClass = clsx(CARD, "flex min-h-[68px] items-center gap-3 px-4 py-3", className);
  if (!linked) return <div className={rowClass}>{body}</div>;
  return (
    <Link href={`/ota-ona/${slug}/kundalik`} className={`${rowClass} transition-transform active:scale-[0.99]`}>
      {body}
    </Link>
  );
}

/**
 * To'lov eslatma kartasi. Muddat hali kelmagan bo'lsa to'q sariq, kechikkan
 * bo'lsa qizil — bola to'lov qilinguncha (invoice PAID bo'lguncha) ko'rinib
 * turadi, buni backend har safar jonli hisoblab beradi.
 */
function PaymentReminderCard({ reminder, payHref }: { reminder: ParentPaymentReminder; payHref?: string }) {
  const tr = useTr();
  const overdue = !!reminder.overdue;
  const color = overdue ? RED : ORANGE;
  return (
    <section className={`${CARD} mt-4 p-4`}>
      <div className="flex items-start gap-3">
        <IosIcon icon={Wallet} tint={overdue ? "red" : "orange"} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold leading-snug text-[var(--p-ink)]">
            {overdue ? tr("To'lov muddati o'tib ketdi") : tr("To'lov muddati yaqinlashmoqda")}
          </p>
          <p className="mt-0.5 text-[14px] leading-relaxed text-[var(--p-muted)]">{tr(reminder.message)}</p>
        </div>
      </div>
      {reminder.amount && (
        <p className="mt-3 text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ color }}>
          {formatMoney(reminder.amount)}
        </p>
      )}
      {payHref && (
        <Link
          href={payHref}
          className="mt-3.5 flex h-11 items-center justify-center rounded-full text-[15.5px] font-semibold text-white transition-transform active:scale-[0.98]"
          style={{ background: color }}
        >
          {tr("To'lov qilish")}
        </Link>
      )}
    </section>
  );
}

const RECEIPT_STATUS: Record<ParentPaymentReceipt["status"], { label: string; color: string }> = {
  PENDING: { label: "Kutilmoqda", color: ORANGE },
  APPROVED: { label: "Tasdiqlangan", color: GREEN },
  REJECTED: { label: "Rad etildi", color: RED },
};

/**
 * Ota-ona to'lov qilganini bildirib chek (skrinshot) yuklaydi — moliyachi
 * tasdiqlamaguncha bola balansiga tegmaydi. Rad etilsa, moliyachi yozgan
 * izoh shu yerda, chekning holati yonida ko'rinadi.
 */
function PaymentReceiptSection({
  childId,
  canSubmit,
  receipts,
}: {
  childId: string;
  canSubmit: boolean;
  receipts: ParentPaymentReceipt[];
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const closeForm = () => {
    setOpen(false);
    setAmount("");
    setImage(null);
    setFormError(null);
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      parentApi.post(`/app/parent/children/${childId}/payment-receipts`, { amount: Number(amount), image }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-payment-receipts", childId] });
      closeForm();
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : tr("Yuborib bo'lmadi — qayta urinib ko'ring")),
  });

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFormError(null);
    setPreparing(true);
    try {
      const result = await prepareReceiptPhoto(file);
      if (!result.ok) {
        setFormError(result.reason);
        return;
      }
      setImage(result.image);
    } finally {
      setPreparing(false);
    }
  };

  return (
    <section className={`${CARD} mt-4 p-4`}>
      <div className="flex items-center gap-3">
        <IosIcon icon={ReceiptText} tint="green" size={32} />
        <p className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[var(--p-ink)]">{tr("To'lov cheki")}</p>
        {canSubmit && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-9 shrink-0 rounded-full bg-[#007aff]/12 px-3.5 text-[14px] font-semibold text-[#007aff] transition-transform active:scale-95"
          >
            {tr("Chek yuklash")}
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!image) {
              setFormError(tr("Chek suratini tanlang"));
              return;
            }
            if (!amount || Number(amount) <= 0) {
              setFormError(tr("Summani kiriting"));
              return;
            }
            setFormError(null);
            submitMutation.mutate();
          }}
          className="mt-3.5 space-y-2.5"
        >
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={tr("To'lov summasi (so'm)")}
            aria-label={tr("To'lov summasi (so'm)")}
            className="h-12 w-full rounded-[14px] bg-[var(--p-sunken)] px-4 text-[17px] font-semibold tabular-nums text-[var(--p-ink)] outline-none placeholder:font-normal placeholder:text-[var(--p-muted)] focus:ring-2 focus:ring-[#007aff]/40"
          />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePick} />
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- tanlangan fayl, brauzerda tayyorlangan
            <img
              src={image}
              alt={tr("Tanlangan chek")}
              onClick={() => fileInputRef.current?.click()}
              className="max-h-44 w-full cursor-pointer rounded-[14px] bg-[var(--p-sunken)] object-contain"
            />
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={preparing}
              className="flex h-[72px] w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--p-sunken)] text-[15px] font-medium text-[#007aff] disabled:opacity-60"
            >
              <ImagePlus className="h-5 w-5" strokeWidth={2} />
              {preparing ? tr("Tayyorlanmoqda...") : tr("Chek suratini tanlash")}
            </button>
          )}
          {formError && <p className="px-1 text-[13px] text-[#ff3b30]">{tr(formError)}</p>}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={closeForm}
              className="h-11 flex-1 rounded-full bg-[var(--p-sunken)] text-[15.5px] font-semibold text-[var(--p-ink)] transition-transform active:scale-[0.98]"
            >
              {tr("Bekor qilish")}
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending || preparing}
              className="h-11 flex-1 rounded-full bg-[#007aff] text-[15.5px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              {submitMutation.isPending ? tr("Yuborilmoqda...") : tr("Yuborish")}
            </button>
          </div>
        </form>
      )}

      {receipts.length > 0 && (
        <ul className="mt-3 divide-y divide-[var(--p-line)] border-t border-[var(--p-line)]">
          {receipts.slice(0, 5).map((r) => {
            const state = RECEIPT_STATUS[r.status];
            return (
              <li key={r.id} className="flex min-h-[44px] items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium tabular-nums text-[var(--p-ink)]">
                    {formatMoney(r.claimedAmount, r.currency)}
                  </span>
                  {r.status === "REJECTED" && r.reviewNote && (
                    <span className="block truncate text-[13px] text-[var(--p-muted)]">{r.reviewNote}</span>
                  )}
                </span>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
                  style={{ color: state.color, background: `color-mix(in srgb, ${state.color} 13%, transparent)` }}
                >
                  {tr(state.label)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
