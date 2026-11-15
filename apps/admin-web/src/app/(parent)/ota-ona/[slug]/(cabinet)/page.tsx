"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FolderOpen,
  ImagePlus,
  Moon,
  NotebookPen,
  PencilLine,
  ReceiptText,
  Send,
  Smile,
  Soup,
  StickyNote,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
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
import { NotifyTeacherForm } from "./notify-teacher";
import { HomeSheet } from "./home-sheet";
import { useSelectedChild } from "./use-selected-child";
import { useParentMessages } from "./use-messages";
import { useParentFeatures } from "./use-parent-features";
import { FoydaliCards } from "./foydali-cards";
import { useTr } from "@/i18n/tr";

/**
 * Ota-ona kabinetining bosh sahifasi — zamonaviy mobil ilova ko'rinishida
 * (egasining qarori, 2026-11-16): salomlashuv, rangli asosiy karta, tezkor
 * amallar, davomat halqasi, rangli plitkalar va yonga suriladigan «Foydali».
 * Ranglar kabinet tokenlaridan (parent.module.css) — qorong'i rejimda ham
 * ishlaydi; gradient faqat asosiy kartada.
 *
 * Tartib: tepa → yangi xabar → asosiy karta → (sabab) → tezkor amallar →
 * davomat → to'lov → bugungi kun → Foydali.
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
const GREEN = "var(--p-mint)";
const RED = "var(--p-red)";
const ORANGE = "var(--p-sun)";

const CARD = "rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]";
/** Asosiy karta va avatar gradienti — ilovaning urg'u ranglari (ko'k → binafsha) */
const HERO_GRADIENT = "linear-gradient(135deg, #0a84ff 0%, #5e5ce6 58%, #a45cf0 118%)";

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
  const [notifyOpen, setNotifyOpen] = useState(false);
  const closeNotify = useCallback(() => setNotifyOpen(false), []);

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
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--p-accent)] border-t-transparent" />
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
    ? { dot: "#30d158", pill: tr("Bog'chada"), icon: Check, title: tr("Bugun bog'chada") }
    : absent
      ? { dot: "#ff6b61", pill: tr("Kelmadi"), icon: X, title: tr("Bugun kelmadi") }
      : { dot: "rgba(255,255,255,0.65)", pill: tr("Kutilmoqda"), icon: Clock3, title: tr("Hali belgilanmagan") };
  const StatusIcon = status.icon;
  const statusNote = present
    ? day?.attendance?.checkInTime
      ? // Yuz tanish terminali yozgan vaqt
        `${day.attendance.checkInTime} da keldi${day.attendance.checkOutTime ? ` · ${day.attendance.checkOutTime} da ketdi` : ""}`
      : tr("Tarbiyachi davomatni belgiladi")
    : absent
      ? day?.attendance?.parentReason || day?.attendance?.note || tr("Sabab ko'rsatilmagan")
      : tr("Tarbiyachi hali davomat qilmadi");

  // Tezkor amallar — pastki menyuda «Yana» ichida qolgan bo'limlarga bir bosishda.
  // Platforma o'chirgan bo'lim chiqmaydi; eng ko'pi to'rtta.
  const base = `/ota-ona/${slug}`;
  const actions = (
    [
      childId && isOn("employeeNotifications")
        ? { key: "notify", label: tr("Xabar berish"), icon: Send, tint: "blue", onClick: () => setNotifyOpen(true) }
        : null,
      isOn("paymentReceipts") ? { key: "tolov", label: tr("To'lov"), icon: Wallet, tint: "green", href: `${base}/tolov` } : null,
      isOn("groupMaterials") ? { key: "fayllar", label: tr("Fayllar"), icon: FolderOpen, tint: "orange", href: `${base}/fayllar` } : null,
      // Do'kon «Yana» ichida qoladi; bu yerda — bog'cha xabarlari, o'qilmaganlar soni bilan
      isOn("notifications")
        ? { key: "xabarlar", label: tr("Bildirishnomalar"), icon: Bell, tint: "indigo", href: `${base}/xabarlar`, badge: newMessages.length }
        : null,
      isOn("diary") ? { key: "kundalik", label: tr("Kundalik"), icon: NotebookPen, tint: "purple", href: `${base}/kundalik` } : null,
      isOn("lessons") ? { key: "jadval", label: tr("Jadval"), icon: CalendarDays, tint: "red", href: `${base}/jadval` } : null,
    ] as Array<QuickAction | null>
  )
    .filter((action): action is QuickAction => !!action)
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      {/* Tepa: avatar, salomlashuv va xabarlar. Chiqish tugmasi Sozlamalar bo'limida. */}
      <header className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
          style={{ background: HERO_GRADIENT }}
          aria-hidden="true"
        >
          {lettersOf(parent.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-tight text-[var(--p-muted)]">{tr(greetingKey())}</p>
          <p className="mt-0.5 truncate text-[19px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">
            {tr(parent.fullName)}
          </p>
        </div>
        {featuresReady && isOn("notifications") && (
          <Link
            href={`${base}/xabarlar`}
            aria-label={newMessages.length > 0 ? tr("{0} ta yangi xabar", newMessages.length) : tr("Xabarlar")}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--p-sunken)] text-[var(--p-ink)] transition-transform active:scale-95"
          >
            <Bell className="h-[21px] w-[21px]" strokeWidth={2} />
            {newMessages.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[var(--p-red)] px-1 text-[11.5px] font-bold tabular-nums text-white ring-2 ring-[var(--p-bg)]">
                {newMessages.length > 9 ? "9+" : newMessages.length}
              </span>
            )}
          </Link>
        )}
      </header>

      {/* Yangi xabar — bildirishnoma ko'rinishida */}
      {newMessages.length > 0 && (
        <Link href={`${base}/xabarlar`} className={`${CARD} mt-4 flex items-start gap-3 p-3.5 transition-transform active:scale-[0.99]`}>
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

      {/* Asosiy karta: bola va bugungi holat — rangli, ilovaning «yuzi» */}
      {child && (
        <section
          className={`${styles.pop} relative mt-5 overflow-hidden rounded-[28px] p-5 text-white`}
          style={{ background: HERO_GRADIENT, boxShadow: "0 22px 44px -22px rgba(88, 86, 214, 0.65)" }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-white/[0.07]" />

          <div className="relative flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-[13px] font-medium text-white/75">{longDate}</p>
            {attendanceOn && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[12.5px] font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ background: status.dot }} />
                {status.pill}
              </span>
            )}
          </div>

          <div className="relative mt-4 flex items-center gap-3.5">
            {child.avatarUpdatedAt ? (
              // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil
              <img
                src={`${PARENT_API_URL}/app/parent/children/${child.id}/avatar?v=${encodeURIComponent(child.avatarUpdatedAt)}`}
                alt={tr(child.fullName)}
                className="h-16 w-16 shrink-0 rounded-full bg-white/20 object-cover ring-2 ring-white/60"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-[21px] font-semibold ring-2 ring-white/40">
                {lettersOf(child.fullName)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[23px] font-bold leading-tight tracking-[-0.02em]">{tr(child.fullName)}</h1>
              <GroupLine child={child} size={20} className="mt-1 text-[14.5px] text-white/80" />
            </div>
          </div>

          {(attendanceOn || multiple) && (
            <div className="relative mt-4 flex items-center gap-3 rounded-[18px] bg-white/[0.16] p-3">
              {attendanceOn ? (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/25">
                    <StatusIcon className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15.5px] font-semibold leading-snug">{status.title}</p>
                    <p className="line-clamp-2 text-[13px] leading-snug text-white/75">{statusNote}</p>
                  </div>
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[14px] text-white/85">{tr("Farzandni almashtirish")}</span>
              )}
              {/* Bir nechta farzand bo'lsa — almashtirish */}
              {multiple && (
                <Link
                  href={`${base}/tanlash`}
                  aria-label={tr("Farzandni almashtirish")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/25 transition-transform active:scale-95"
                >
                  <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </Link>
              )}
            </div>
          )}
        </section>
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
          className={`${CARD} mt-3 p-4`}
        >
          <div className="flex items-center gap-3">
            <IosIcon icon={PencilLine} tint="red" size={32} />
            <label htmlFor="absence-reason" className="min-w-0 flex-1 text-[16px] font-semibold leading-snug text-[var(--p-ink)]">
              {tr("Nega kelmadi? Sababini yozing")}
            </label>
          </div>
          <textarea
            id="absence-reason"
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            rows={2}
            placeholder={tr("Masalan: shifokorga bordik")}
            className="mt-3 w-full resize-none rounded-[14px] bg-[var(--p-sunken)] px-3.5 py-2.5 text-[16px] text-[var(--p-ink)] outline-none placeholder:text-[var(--p-muted)] focus:ring-2 focus:ring-[var(--p-accent)]/40"
          />
          <button
            type="submit"
            disabled={!reasonDraft.trim() || reasonMutation.isPending}
            className="mt-2 h-11 w-full rounded-full bg-[var(--p-accent)] text-[15.5px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {reasonMutation.isPending ? tr("Yuborilmoqda...") : tr("Yuborish")}
          </button>
          {reasonMutation.isError && (
            <p className="mt-2 px-1 text-[13px] text-[var(--p-red)]">{tr("Yuborib bo'lmadi — qayta urinib ko'ring")}</p>
          )}
        </form>
      )}

      {/* Tezkor amallar — ilova yorliqlari kabi */}
      {featuresReady && actions.length > 0 && (
        <nav
          aria-label={tr("Tezkor amallar")}
          className="mt-5 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
        >
          {actions.map((action) => {
            const badge = action.badge ?? 0;
            const inner = (
              <>
                <span className="relative">
                  <IosIcon icon={action.icon} tint={action.tint} size={54} />
                  {badge > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2 -top-2 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[var(--p-red)] px-1.5 text-[12.5px] font-bold tabular-nums text-white ring-2 ring-[var(--p-bg)]"
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="mt-2 line-clamp-2 max-w-full break-words text-center text-[12.5px] font-medium leading-tight text-[var(--p-ink)]">
                  {action.label}
                </span>
              </>
            );
            const label = badge > 0 ? `${action.label}, ${tr("{0} ta yangi", badge)}` : undefined;
            const className = "flex min-w-0 flex-col items-center rounded-[18px] px-1 py-1.5 transition-transform active:scale-95";
            return action.href ? (
              <Link key={action.key} href={action.href} aria-label={label} className={className}>
                {inner}
              </Link>
            ) : (
              <button key={action.key} type="button" onClick={action.onClick} aria-label={label} className={className}>
                {inner}
              </button>
            );
          })}
        </nav>
      )}

      {/* Maqolalar, o'yinlar, galereya — tezkor amallardan keyin, ko'zga birinchi tashlanadi.
          Platforma o'chirganlari chiqmaydi */}
      {featuresReady && <FoydaliCards slug={slug} articlesOn={isOn("articles")} galleryOn={isOn("gallery")} />}

      {/* To'lov eslatmasi — bog'cha sozlagan kunlar oynasida to'lanmagan
          hisob-faktura bo'lsa chiqadi, to'lov qilingach o'zi yo'qoladi.
          «To'lov cheklari» o'chirilgan bo'lsa To'lov sahifasi yo'q — tugma ham yo'q */}
      {reminderQuery.data?.visible && (
        <PaymentReminderCard reminder={reminderQuery.data} payHref={isOn("paymentReceipts") ? `${base}/tolov` : undefined} />
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
              <div key={i} className="h-[112px] animate-pulse rounded-[22px] bg-[var(--p-sunken)] motion-reduce:animate-none" />
            ))}
          </div>
          <div className="mt-3 h-[76px] animate-pulse rounded-[var(--p-radius)] bg-[var(--p-sunken)] motion-reduce:animate-none" />
        </div>
      ) : (
        day &&
        (reportsOn || nutritionOn) && (
          <section className="mt-8">
            <SectionTitle>{tr("Bugun")}</SectionTitle>

            {/* Kayfiyat, ovqat, uyqu — rangli plitkalar */}
            {reportsOn && (
              <div className="grid grid-cols-3 gap-3">
                <StatTile icon={Smile} color="#ff2d55" label={tr("Kayfiyat")} value={day.report?.mood ? tr(MOOD[day.report.mood]) : "—"} />
                <StatTile
                  icon={Utensils}
                  color="#ff9500"
                  label={tr("Ovqat")}
                  value={day.report?.eatingQuality ? tr(EATING[day.report.eatingQuality]) : "—"}
                />
                <StatTile
                  icon={Moon}
                  color="#5856d6"
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

      {/* Davomat — foiz halqasi va oxirgi 2 hafta kalendari; sahifaning eng pastida */}
      {attendanceOn && stripQuery.data && <AttendanceCard strip={stripQuery.data} />}

      <p className="mt-6 px-6 text-center text-[13px] leading-relaxed text-[var(--p-muted)]">
        {tr("Savolingiz bo'lsa — tarbiyachi yoki bog'cha ma'muriyatiga murojaat qiling")}
      </p>

      {/* Tarbiyachiga xabar — pastki oynada. Xabar xodim bildirishnomasi bo'lib boradi. */}
      {notifyOpen && childId && (
        <HomeSheet title={tr("Tarbiyachiga xabar")} onClose={closeNotify}>
          <NotifyTeacherForm childId={childId} departureEnabled={isOn("pickups")} />
        </HomeSheet>
      )}
    </div>
  );
}

type QuickAction = {
  key: string;
  label: string;
  icon: AnyIcon;
  tint: IosTint;
  href?: string;
  onClick?: () => void;
  /** Ikonka burchagidagi qizil son (iOS ilova belgisidek); 0 bo'lsa chiqmaydi */
  badge?: number;
};

/** Bosh harflar — faqat harflardan («[SINOV] Ali Vali» → «AV»); harf topilmasa umumiy `initials` */
function lettersOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => word.match(/\p{L}/u)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || initials(name);
}

/** Vaqtga qarab salomlashuv (qurilma soati bo'yicha) */
function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 5 || hour >= 22) return "Xayrli tun";
  if (hour < 11) return "Xayrli tong";
  if (hour < 17) return "Xayrli kun";
  return "Xayrli kech";
}

/** Bo'lim sarlavhasi — kartadan tashqarida, yirik va qalin */
function SectionTitle({ children, trailing }: { children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">{children}</h2>
      {trailing && <span className="shrink-0 text-[14px] text-[var(--p-muted)]">{trailing}</span>}
    </div>
  );
}

/** Rangli plitka: o'z rangining och tusi fonda, dumaloq belgi, nom va qiymat */
function StatTile({ icon: Icon, color, label, value }: { icon: LucideIcon; color: string; label: string; value: string }) {
  return (
    <div className="rounded-[22px] p-3.5" style={{ background: `color-mix(in srgb, ${color} 11%, var(--p-card))` }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: color }}>
        <Icon className="h-[17px] w-[17px]" strokeWidth={2.3} aria-hidden="true" />
      </span>
      <p className="mt-3 truncate text-[12.5px] font-medium text-[var(--p-ink)]/60">{label}</p>
      <p className="mt-0.5 text-[16px] font-bold leading-tight text-[var(--p-ink)] [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

/**
 * Davomat — oxirgi 2 hafta.
 *
 * Chapda halqa: belgilangan kunlarning necha foizida kelgani (eng ko'p
 * so'raladigan savolga bir qarashda javob). O'ngda kalendar: har bir kun
 * o'z hafta kuni ustunida, doiracha rangi — holati. Pastda sonlar.
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
  const marked = strip.present + strip.absent;
  const rate = marked > 0 ? strip.present / marked : null;
  const R = 38;
  const C = 2 * Math.PI * R;
  const legend = [
    { count: strip.present, label: "kun keldi", color: GREEN },
    { count: strip.absent, label: "kun kelmadi", color: RED },
    ...(unmarked > 0 ? [{ count: unmarked, label: "kun belgilanmagan", color: "var(--p-chevron)" }] : []),
  ];

  return (
    <section className={`${CARD} mt-8 p-4`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--p-ink)]">{tr("Davomat")}</h2>
        <span className="shrink-0 text-[13px] text-[var(--p-muted)]">{tr("Oxirgi 2 hafta")}</span>
      </div>

      <div className="mt-3.5 flex items-center gap-4">
        {/* Halqa */}
        <div className="relative h-[92px] w-[92px] shrink-0">
          <svg viewBox="0 0 92 92" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="46" cy="46" r={R} fill="none" stroke="var(--p-sunken)" strokeWidth="9" />
            {rate !== null && rate > 0 && (
              <circle
                cx="46"
                cy="46"
                r={R}
                fill="none"
                stroke="var(--p-mint)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - rate)}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[21px] font-bold leading-none tabular-nums text-[var(--p-ink)]">
              {rate === null ? "—" : `${Math.round(rate * 100)}%`}
            </span>
            {rate !== null && <span className="mt-1 text-[11px] text-[var(--p-muted)]">{tr("keldi")}</span>}
          </div>
        </div>

        {/* Kalendar */}
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-x-1 gap-y-1.5">
          {WEEKDAY_SHORT.map((d) => (
            <span key={d} className="truncate text-center text-[10.5px] font-medium text-[var(--p-muted)]">
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
                  "mx-auto flex aspect-square w-full max-w-[28px] items-center justify-center rounded-full text-[11.5px] font-semibold tabular-nums",
                  item.status === "PRESENT"
                    ? "bg-[var(--p-mint)] text-white"
                    : item.status === "ABSENT"
                      ? "bg-[var(--p-red)] text-white"
                      : rest
                        ? "text-[var(--p-chevron)]"
                        : "bg-[var(--p-sunken)] text-[var(--p-muted)]",
                  // Bugungi kun — ko'k halqa
                  item.date === today && "ring-2 ring-[var(--p-accent)] ring-offset-1 ring-offset-[var(--p-card)]",
                )}
              >
                {Number(item.date.slice(8, 10))}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--p-line)] pt-3">
        {legend.map((entry) => (
          <span key={entry.label} className="flex items-center gap-1.5 text-[13px] text-[var(--p-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
            <b className="font-semibold tabular-nums text-[var(--p-ink)]">{entry.count}</b> {tr(entry.label)}
          </span>
        ))}
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
      {linked && <ChevronRight className="h-5 w-5 shrink-0 text-[var(--p-chevron)]" strokeWidth={2.4} aria-hidden="true" />}
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
            className="h-9 shrink-0 rounded-full bg-[var(--p-accent)]/12 px-3.5 text-[14px] font-semibold text-[var(--p-accent)] transition-transform active:scale-95"
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
            className="h-12 w-full rounded-[14px] bg-[var(--p-sunken)] px-4 text-[17px] font-semibold tabular-nums text-[var(--p-ink)] outline-none placeholder:font-normal placeholder:text-[var(--p-muted)] focus:ring-2 focus:ring-[var(--p-accent)]/40"
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
              className="flex h-[72px] w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--p-sunken)] text-[15px] font-medium text-[var(--p-accent)] disabled:opacity-60"
            >
              <ImagePlus className="h-5 w-5" strokeWidth={2} />
              {preparing ? tr("Tayyorlanmoqda...") : tr("Chek suratini tanlash")}
            </button>
          )}
          {formError && <p className="px-1 text-[13px] text-[var(--p-red)]">{tr(formError)}</p>}
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
              className="h-11 flex-1 rounded-full bg-[var(--p-accent)] text-[15.5px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
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
