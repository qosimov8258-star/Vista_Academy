"use client";

import { use, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Bell, Check, ChevronRight, KeyRound, Languages, LogOut, SunMoon } from "lucide-react";
import { useLocale } from "next-intl";
import { parentApi } from "@/lib/parent-api";
import { getPushStatus, subscribeToPush, unsubscribeFromPush, type PushStatus } from "@/lib/push";
import type { ParentAccount, ParentChild } from "@/lib/types";
import { locales, type Locale } from "@/i18n/config";
import { changeParentLocale } from "../locale-sync";
import { useTr } from "@/i18n/tr";
import styles from "../../parent.module.css";
import { useCabinetTheme, type ThemeMode } from "../theme";
import { PasswordSheet } from "./password-sheet";
import { useParentFeatures } from "../use-parent-features";

/**
 * Sozlamalar — iOS «Sozlamalar» ilovasi uslubida: tepada kabinet egasi,
 * pastda guruhlangan ro'yxatlar (rangli belgi, qiymat, `›`). Til va
 * ko'rinish pastdan chiqadigan tanlov varag'ida, chiqish — tasdiqlash
 * varag'i bilan. Ranglar kabinet mavzusidan (yorug'/qorong'i) olinadi.
 */

/** Telefonning o'z vaqt mintaqasida: ota-ona qayerda bo'lsa, o'sha soat */
function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

/** Til nomlari o'z tilida yoziladi — qaysi til tanlangan bo'lsa ham tanish bo'lsin */
const LOCALE_NAMES: Record<Locale, string> = { uz: "O'zbekcha", ru: "Русский", en: "English" };

const THEME_LABELS: Record<ThemeMode, string> = { avto: "Avtomatik", yorug: "Yorug'", qorongi: "Qorong'i" };
const THEME_ORDER: ThemeMode[] = ["avto", "yorug", "qorongi"];

/** iOS tizim ranglari — belgilar plitkasi uchun */
const TINT = { blue: "#007aff", indigo: "#5856d6", red: "#ff3b30", gray: "#8e8e93" } as const;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    // Birinchi harf ([SINOV] kabi belgilar tashlab ketiladi)
    .map((part) => part.match(/\p{L}/u)?.[0]?.toUpperCase() ?? "")
    .join("");
}

/* ───────────────────────── iOS bo'laklari ───────────────────────── */

function Section({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-5">
      {title && <p className="mb-1.5 px-4 text-[13px] uppercase tracking-wide text-[var(--p-muted)]">{title}</p>}
      <div className="overflow-hidden rounded-[18px] bg-[var(--p-card)] shadow-[var(--p-shadow)]">{children}</div>
      {footer && <div className="mt-1.5 px-4 text-[13px] leading-snug text-[var(--p-muted)]">{footer}</div>}
    </section>
  );
}

/** Rangli kvadrat belgi — iOS sozlamalaridagidek */
function Tile({ icon: Icon, tint }: { icon: ComponentType<{ className?: string; strokeWidth?: number }>; tint: string }) {
  return (
    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-white" style={{ backgroundColor: tint }} aria-hidden="true">
      <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
    </span>
  );
}

/**
 * Bitta qator. Ajratuvchi chiziq belgidan keyin boshlanadi (iOS'dagidek),
 * oxirgi qatorda yo'q. `onClick` bo'lsa — bosiladigan, `›` bilan.
 */
function Row({
  icon,
  tint,
  title,
  value,
  onClick,
  trailing,
  chevron = !!onClick,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  tint: string;
  title: string;
  value?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  chevron?: boolean;
}) {
  const content = (
    <>
      <Tile icon={icon} tint={tint} />
      <span className="flex min-h-[50px] min-w-0 flex-1 items-center gap-2 border-b border-[var(--p-line)] py-2.5 pr-4 group-last/row:border-b-0">
        <span className="min-w-0 flex-1 truncate text-[16px] text-[var(--p-ink)]">{title}</span>
        {value && <span className="shrink-0 truncate text-[16px] text-[var(--p-muted)]">{value}</span>}
        {trailing}
        {chevron && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[var(--p-muted)]/60" strokeWidth={2.4} aria-hidden="true" />}
      </span>
    </>
  );
  const rowClass = "group/row flex w-full items-center gap-3 pl-4 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={clsx(rowClass, "cursor-pointer transition-colors active:bg-[var(--p-sunken)]")}>
      {content}
    </button>
  ) : (
    <div className={rowClass}>{content}</div>
  );
}

/** iOS kaliti (51×31, yashil) */
function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={clsx(
        "relative h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 disabled:opacity-60",
        checked ? "bg-[var(--p-mint)]" : "bg-[var(--p-muted)]/25",
      )}
    >
      <span
        className={clsx(
          "absolute left-0 top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06)] transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

/** Pastdan chiqadigan varaq — orqa fon bosilsa yopiladi */
function BottomSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const tr = useTr();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label={tr("Yopish")} onClick={onClose} className={`${styles.fadeIn} absolute inset-0 cursor-default bg-black/40`} />
      <div
        className={`${styles.sheetIn} relative w-full max-w-[520px] px-2`}
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Belgichali tanlov ro'yxati (til, ko'rinish) */
function ChoiceSheet<T extends string>({
  title,
  footer,
  options,
  value,
  onPick,
  onClose,
}: {
  title: string;
  footer?: ReactNode;
  options: Array<{ value: T; label: string }>;
  value: T;
  onPick: (value: T) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  return (
    <BottomSheet label={title} onClose={onClose}>
      <div className="overflow-hidden rounded-[18px] bg-[var(--p-card)]">
        <p className="border-b border-[var(--p-line)] px-4 py-3 text-center text-[13px] font-semibold text-[var(--p-muted)]">{title}</p>
        <div role="radiogroup" aria-label={title}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  onPick(option.value);
                  onClose();
                }}
                className="group/row flex w-full cursor-pointer items-center pl-4 text-left transition-colors active:bg-[var(--p-sunken)]"
              >
                <span className="flex min-h-[52px] flex-1 items-center border-b border-[var(--p-line)] pr-4 group-last/row:border-b-0">
                  <span className="flex-1 text-[16px] text-[var(--p-ink)]">{option.label}</span>
                  {active && <Check className="h-5 w-5 text-[var(--p-accent)]" strokeWidth={2.6} aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>
        {footer && <div className="border-t border-[var(--p-line)] px-4 py-3 text-[13px] leading-snug text-[var(--p-muted)]">{footer}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 flex h-[56px] w-full cursor-pointer items-center justify-center rounded-[18px] bg-[var(--p-card)] text-[16px] font-semibold text-[var(--p-accent)] transition-colors active:bg-[var(--p-sunken)]"
      >
        {tr("Bekor qilish")}
      </button>
    </BottomSheet>
  );
}

/* ───────────────────────── sahifa ───────────────────────── */

export default function ParentSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const locale = useLocale() as Locale;
  const { slug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<"language" | "theme" | "logout" | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("unsubscribed");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  // Push — «Bildirishnomalar» funksiyasi; o'chirilgan bo'lsa qator ko'rinmaydi
  const features = useParentFeatures(slug);
  const pushOn = features.ready && features.isOn("notifications");
  const { mode, setMode, dark, sky } = useCabinetTheme();

  useEffect(() => {
    getPushStatus().then(setPushStatus);
  }, []);

  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  const parent = meQuery.data?.parent;

  const togglePush = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      if (pushStatus === "subscribed") {
        await unsubscribeFromPush();
        setPushStatus("unsubscribed");
      } else {
        await subscribeToPush();
        setPushStatus("subscribed");
      }
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Xatolik yuz berdi");
    } finally {
      setPushBusy(false);
    }
  };

  const logout = async () => {
    setLeaving(true);
    // Ota-ona seansi cookie'da — logout uni server tomonda bekor qiladi
    await parentApi.post("/app/parent/logout").catch(() => undefined);
    // Keyingi kiruvchi (umumiy qurilmada boshqa ota-ona) avvalgi bolalar
    // ma'lumotini keshdan ko'rmasin
    queryClient.clear();
    router.replace(`/ota-ona/${slug}/kirish`);
  };

  const themeNote =
    mode === "avto" && sky
      ? dark
        ? tr("Hozir tun — qorong'i ko'rinish yoqilgan{0}.", sky.sunrise ? `, tong ${clock(sky.sunrise)} da yorishadi` : "")
        : tr("Hozir kunduz — qorong'i ko'rinish quyosh botganda{0} yonadi.", sky.sunset ? ` (${clock(sky.sunset)})` : "")
      : null;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pb-6 pt-5">
      <h1 className="px-1 text-[28px] font-bold leading-tight tracking-[-0.01em] text-[var(--p-ink)]">{tr("Sozlamalar")}</h1>

      {/* Kabinet egasi — iOS'dagi profil qatori kabi */}
      {parent ? (
        <Section footer={tr("Shu raqam — kabinetning logini. Ota va ona bitta kabinetdan foydalanadi.")}>
          <div className="flex items-center gap-3.5 px-4 py-3">
            <span
              className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full text-[22px] font-semibold"
              style={{ backgroundColor: "color-mix(in srgb, var(--p-accent) 14%, transparent)", color: "var(--p-accent)" }}
              aria-hidden="true"
            >
              {initialsOf(parent.fullName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[20px] font-semibold leading-tight text-[var(--p-ink)]">{tr(parent.fullName)}</span>
              <span className="mt-0.5 block truncate text-[15px] tabular-nums text-[var(--p-muted)]">
                {tr("Kabinet egasi")} · {parent.phone}
              </span>
            </span>
          </div>
        </Section>
      ) : (
        <div className="mt-5 h-[84px] animate-pulse rounded-[18px] bg-[var(--p-sunken)]" />
      )}

      {/* Umumiy: til va ko'rinish */}
      <Section title={tr("Umumiy")} footer={themeNote}>
        <Row icon={Languages} tint={TINT.blue} title={tr("Til")} value={LOCALE_NAMES[locale]} onClick={() => setSheet("language")} />
        <Row icon={SunMoon} tint={TINT.indigo} title={tr("Ko'rinish")} value={tr(THEME_LABELS[mode])} onClick={() => setSheet("theme")} />
      </Section>

      {/* Xavfsizlik — ota va ona bitta parolni ishlatadi */}
      {parent && (
        <Section title={tr("Xavfsizlik")} footer={tr("Bog'cha bergan parol o'rniga o'zingiznikini qo'ying")}>
          <Row icon={KeyRound} tint={TINT.gray} title={tr("Parolni almashtirish")} onClick={() => setPasswordOpen(true)} />
        </Section>
      )}

      {/* Chiqish — iOS'dagidek qizil, markazda */}
      <section className="mt-7">
        <button
          type="button"
          onClick={() => setSheet("logout")}
          className="flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-[18px] bg-[var(--p-card)] text-[16px] text-[var(--p-red)] shadow-[var(--p-shadow)] transition-colors active:bg-[var(--p-sunken)]"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
          {tr("Kabinetdan chiqish")}
        </button>
      </section>

      {/* Bildirishnomalar — to'lov eslatmasi kabi xabarlar kabinet yopiq bo'lsa ham keladi */}
      {pushOn && pushStatus !== "unsupported" && (
        <Section
          footer={
            pushError ? (
              <span className="text-[var(--p-red)]">{pushError}</span>
            ) : (
              tr("To'lov eslatmasi kabi xabarlarni brauzer orqali, kabinetni ochmasdan ham oling")
            )
          }
        >
          <Row
            icon={Bell}
            tint={TINT.red}
            title={tr("Bildirishnomalar")}
            trailing={<Switch checked={pushStatus === "subscribed"} disabled={pushBusy} onChange={togglePush} label={tr("Bildirishnomalar")} />}
          />
        </Section>
      )}

      {/* Hali tayyor bo'lmagan qism — bo'sh joy qoldirmaymiz */}
      <Section>
        <div className="flex min-h-[50px] items-center gap-3 px-4 py-3">
          <span className="shrink-0 rounded-full bg-[#ff9500]/[0.14] px-2.5 py-1 text-[12px] font-semibold text-[#ff9500]">{tr("Tez orada")}</span>
          <span className="min-w-0 flex-1 text-[15px] text-[var(--p-muted)]">{tr("Aloqa ma'lumotlari shu yerda bo'ladi.")}</span>
        </div>
      </Section>

      {sheet === "language" && (
        <ChoiceSheet<Locale>
          title={tr("Til")}
          footer={tr("Kabinetdagi barcha matnlar tanlangan tilda chiqadi.")}
          options={locales.map((code) => ({ value: code, label: LOCALE_NAMES[code] }))}
          value={locale}
          onPick={(code) => {
            // Saqlanmasa til o'zgarmaydi — varaq ochiq qoladi, qayta urinish mumkin
            if (code !== locale) changeParentLocale(code).catch(() => undefined);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "theme" && (
        <ChoiceSheet<ThemeMode>
          title={tr("Ko'rinish")}
          footer={tr("Avtomatik rejimda quyosh botganda qorong'i ko'rinish o'zi yonadi, tongda o'chadi.")}
          options={THEME_ORDER.map((m) => ({ value: m, label: tr(THEME_LABELS[m]) }))}
          value={mode}
          onPick={setMode}
          onClose={() => setSheet(null)}
        />
      )}

      {/* Chiqishni tasdiqlash — iOS harakat varag'i */}
      {sheet === "logout" && (
        <BottomSheet label={tr("Kabinetdan chiqasizmi?")} onClose={() => !leaving && setSheet(null)}>
          <div className="overflow-hidden rounded-[18px] bg-[var(--p-card)]">
            <div className="border-b border-[var(--p-line)] px-6 py-4 text-center">
              <p className="text-[13px] font-semibold text-[var(--p-muted)]">{tr("Kabinetdan chiqasizmi?")}</p>
              <p className="mt-1 text-[13px] leading-snug text-[var(--p-muted)]">
                {tr("Keyingi safar telefon raqamingiz va parolingiz bilan qayta kirasiz.")}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={leaving}
              className="flex h-[56px] w-full cursor-pointer items-center justify-center text-[16px] text-[var(--p-red)] transition-colors active:bg-[var(--p-sunken)] disabled:opacity-60"
            >
              {leaving ? tr("Chiqilmoqda…") : tr("Chiqish")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSheet(null)}
            disabled={leaving}
            className="mt-2 flex h-[56px] w-full cursor-pointer items-center justify-center rounded-[18px] bg-[var(--p-card)] text-[16px] font-semibold text-[var(--p-accent)] transition-colors active:bg-[var(--p-sunken)]"
          >
            {tr("Bekor qilish")}
          </button>
        </BottomSheet>
      )}

      {passwordOpen && parent && (
        <PasswordSheet
          slug={slug}
          phone={parent.phone}
          onClose={() => setPasswordOpen(false)}
          onSignedOut={() => router.replace(`/ota-ona/${slug}/kirish`)}
        />
      )}
    </div>
  );
}
