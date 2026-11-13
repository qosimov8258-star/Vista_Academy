"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, ChevronLeft, Eye, Info, LogIn, MessageSquareText, Phone, ReceiptText, Smartphone } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { formatChildId } from "@/lib/format";
import { ChevronRightIcon } from "@/components/ios/icons";
import { Group as IosGroup } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { ErrorState, SkeletonRows } from "@/components/ios/states";
import { IOS, PAGE_CARD, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";
import { useTr } from "@/i18n/tr";
import { BarChart, LEVEL_META, PAGE_META, RELATION_LABEL, dayMonth, deviceName, formatAgo, formatDuration, formatWhen } from "./engagement-ui";
import type { GuardianEngagementDetail } from "./types";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/**
 * Bitta ota-onaning kabinet faolligi: qachon kirgan, kun/hafta/oy davomida
 * qancha vaqt, qaysi soatlarda, bolasining kuni va kundaligini ko'ryaptimi,
 * oxirgi ko'rganlari, xabarlarni o'qiyaptimi, qaysi qurilmadan kiradi.
 */
export function ParentDetail({ slug, guardianId }: { slug: string; guardianId: string }) {
  const tr = useTr();
  const { branchId, base } = useBranchContext(slug);
  const query = useQuery({
    queryKey: ["parent-engagement", slug, "detail", guardianId, branchId],
    queryFn: () =>
      api.get<GuardianEngagementDetail>(`/app/parent-engagement/${guardianId}${branchId ? `?branchId=${branchId}` : ""}`),
    refetchInterval: 60_000,
  });
  const d = query.data;
  const [allRecent, setAllRecent] = useState(false);

  // «Ota-ona profiliga kirish» — xodimnikidek: kabinet yangi tabda, ota-ona o'zi kirgandek ochiladi
  const { user } = useAuth();
  const canEnter = user?.role === "NETWORK_ADMIN" || user?.role === "BRANCH_ADMIN";
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);
  const enterCabinet = async () => {
    setEnterError(null);
    setEntering(true);
    // Oyna shu bosish ichida ochiladi — aks holda brauzer uni «popup» deb bloklaydi
    const win = window.open("", "_blank");
    try {
      const { ticket } = await api.post<{ ticket: string }>(`/app/parent-engagement/${guardianId}/enter`, {});
      const url = `/ota-ona/${slug}/enter#t=${encodeURIComponent(ticket)}`;
      if (win) win.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      win?.close();
      setEnterError(err instanceof ApiError ? err.message : tr("Kabinetga kirib bo'lmadi"));
    } finally {
      setEntering(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <Link
        href={`${base}/parents`}
        className="-mb-2 inline-flex h-9 items-center gap-0.5 rounded-full pr-3 text-[15px] font-medium text-[var(--color-primary)] active:opacity-60"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
        {tr("Ota-onalar")}
      </Link>

      {query.isError && !d ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : !d ? (
        <>
          <div className={clsx(PAGE_CARD, "h-[104px] animate-pulse")} />
          <SkeletonRows rows={6} />
        </>
      ) : (
        <>
          {/* Sarlavha: kim, darajasi, oxirgi faollik, qo'ng'iroq */}
          <div className={clsx(PAGE_CARD, "flex items-center gap-4 p-4")}>
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[22px] font-semibold"
              style={{ backgroundColor: `${LEVEL_META[d.guardian.level].color}1f`, color: LEVEL_META[d.guardian.level].color }}
              aria-hidden="true"
            >
              {initialsOf(d.guardian.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 data-hero className="truncate text-[20px] font-bold leading-tight tracking-[-0.01em] text-[var(--color-text)]">
                {tr(d.guardian.fullName)}
              </h1>
              <p className="mt-0.5 truncate text-[14px] tabular-nums text-[#8e8e93]">{d.guardian.phone}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Pill color={LEVEL_META[d.guardian.level].color}>{tr(LEVEL_META[d.guardian.level].label)}</Pill>
                {d.guardian.connected && (
                  <span className="text-[13px] text-[#8e8e93]">
                    {tr("Oxirgi faollik")}: {formatAgo(d.guardian.lastActivityAt, tr)}
                  </span>
                )}
              </div>
            </div>
            {canEnter && d.guardian.connected && (
              <button
                type="button"
                onClick={enterCabinet}
                disabled={entering}
                aria-label={tr("{0} kabinetiga kirish", d.guardian.fullName)}
                title={tr("Ota-ona profiliga kirish — yangi tabda, ota-ona o'zi kirgandek")}
                className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--color-primary)]/[0.12] px-3.5 text-[14px] font-semibold text-[var(--color-primary)] active:scale-95 disabled:opacity-60 max-sm:w-11 max-sm:px-0"
              >
                {entering ? (
                  <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <LogIn className="h-[18px] w-[18px]" strokeWidth={2.2} />
                )}
                <span className="max-sm:hidden">{tr("Profiliga kirish")}</span>
              </button>
            )}
            <a
              href={`tel:${d.guardian.phone}`}
              aria-label={tr("{0} ga qo'ng'iroq: {1}", d.guardian.fullName, d.guardian.phone)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#34c759]/[0.14] text-[#34c759] active:scale-90"
            >
              <Phone className="h-5 w-5" strokeWidth={2.2} />
            </a>
          </div>

          {enterError && (
            <p role="alert" className="rounded-[12px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13.5px] text-[#ff3b30]">
              {tr(enterError)}
            </p>
          )}

          {!d.guardian.connected && (
            <div className={clsx(PAGE_CARD, "flex items-start gap-3 p-4")}>
              <IosIcon icon={Info} tint="gray" size={30} />
              <p className="text-[14px] leading-snug text-[var(--color-text)]">
                {tr("Kabinet hali ochilmagan — bu ota-onaga parol berilmagan, shuning uchun u tizimga kira olmaydi. Parolni bola sahifasidagi ota-ona bo'limidan berish mumkin.")}
              </p>
            </div>
          )}

          {/* Vaqt */}
          <IosGroup title={tr("Kabinetda o'tkazilgan vaqt")} bare>
            <StatStrip tone="white">
              <StatCell label={tr("Bugun")} value={formatDuration(d.stats.secondsToday, tr)} />
              <StatCell label={tr("7 kun")} value={formatDuration(d.stats.secondsWeek, tr)} />
              <StatCell label={tr("30 kun")} value={formatDuration(d.stats.secondsMonth, tr)} />
              <StatCell label={tr("Faol kunlar")} value={`${d.stats.activeDays30}`} hint={tr("30 kundan")} />
            </StatStrip>
          </IosGroup>

          <StatStrip tone="white">
            <StatCell label={tr("Kirishlar")} value={`${d.stats.visits30}`} hint={tr("30 kunda")} />
            <StatCell label={tr("O'rtacha kirish")} value={formatDuration(d.stats.avgVisitSeconds, tr)} hint={tr("bir kirishda")} />
            <StatCell
              label={tr("Bolasini ko'rdi")}
              value={`${d.stats.resultViews30}`}
              hint={d.stats.lastResultViewAt ? tr("oxirgi: {0}", formatAgo(d.stats.lastResultViewAt, tr)) : tr("30 kunda ko'rmagan")}
              color={d.stats.resultViews30 > 0 ? undefined : IOS.orange}
            />
            <StatCell
              label={tr("O'qilmagan xabar")}
              value={`${d.messages.unread}`}
              color={d.messages.unread > 0 ? IOS.orange : undefined}
            />
          </StatStrip>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            <IosGroup title={tr("Kunlik vaqt · 30 kun")}>
              <div className="p-4">
                <BarChart
                  values={d.daily.map((x) => Math.round(x.seconds / 60))}
                  labels={d.daily.map((x, i) => (i % 5 === 4 || i === d.daily.length - 1 ? dayMonth(x.date) : ""))}
                  titles={d.daily.map((x) => `${dayMonth(x.date)}: ${formatDuration(x.seconds, tr)}`)}
                  height={130}
                  empty={tr("30 kunda kirmagan")}
                />
                <p className="mt-3 text-[12.5px] text-[#8e8e93]">{tr("Ustun — o'sha kuni kabinetda o'tkazilgan daqiqalar.")}</p>
              </div>
            </IosGroup>
            <IosGroup title={tr("Qaysi soatlarda kiradi")}>
              <div className="p-4">
                <BarChart
                  values={d.hours}
                  labels={d.hours.map((_, h) => (h % 6 === 0 ? `${String(h).padStart(2, "0")}:00` : ""))}
                  titles={d.hours.map((sec, h) => `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59 · ${formatDuration(sec, tr)}`)}
                  height={130}
                  highlightLast={false}
                  empty={tr("Ma'lumot yo'q")}
                />
                <p className="mt-3 text-[12.5px] text-[#8e8e93]">{peakText(d.hours, tr)}</p>
              </div>
            </IosGroup>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            <div className="space-y-5">
              <IosGroup title={tr("Farzandlari")}>
                {d.children.map((c) => (
                  <LinkRow
                    key={c.id}
                    href={`${base}/children/${c.id}`}
                    leading={
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/12 text-[15px] font-semibold text-[var(--color-primary)]">
                        {initialsOf(c.fullName)}
                      </span>
                    }
                    separatorLeft={72}
                    title={tr(c.fullName)}
                    subtitle={[tr(RELATION_LABEL[c.relation]), formatChildId(c.publicId), c.groupName ? tr(c.groupName) : null, c.branchName ? tr(c.branchName) : null]
                      .filter(Boolean)
                      .join(" · ")}
                    trailing={!c.receivesNotifications ? <Pill color={IOS.gray}>{tr("Xabar olmaydi")}</Pill> : undefined}
                  />
                ))}
              </IosGroup>

              <IosGroup title={tr("Bo'limlar · 30 kun")}>
                {d.pages.length === 0 ? (
                  <EmptyLine text={tr("30 kunda kabinetda hech narsa ko'rmagan")} />
                ) : (
                  d.pages.map((p) => {
                    const meta = PAGE_META[p.page];
                    return (
                      <InfoRow
                        key={p.page}
                        icon={meta?.icon ?? Eye}
                        tint={meta?.tint ?? "gray"}
                        title={tr(meta?.label ?? p.page)}
                        subtitle={tr("{0} marta · oxirgi: {1}", p.views, formatAgo(p.lastAt, tr))}
                        value={formatDuration(p.seconds, tr)}
                      />
                    );
                  })
                )}
              </IosGroup>

              <IosGroup title={tr("Xabarlar")}>
                {d.messages.recent.length === 0 ? (
                  <EmptyLine text={tr("Bu ota-onaga hali xabar yuborilmagan")} />
                ) : (
                  d.messages.recent.map((m, i) => (
                    <InfoRow
                      key={i}
                      icon={MessageSquareText}
                      tint={m.mandatory ? "red" : "indigo"}
                      title={m.title}
                      subtitle={`${tr("Yuborildi")}: ${formatWhen(m.sentAt)}`}
                      value={
                        m.readAt ? (
                          <span className="text-[13px] font-medium" style={{ color: IOS.green }}>
                            {tr("O'qidi")} · {formatWhen(m.readAt)}
                          </span>
                        ) : (
                          <span className="text-[13px] font-medium" style={{ color: IOS.orange }}>
                            {tr("O'qimagan")}
                          </span>
                        )
                      }
                    />
                  ))
                )}
              </IosGroup>
            </div>

            <div className="space-y-5">
              <IosGroup title={tr("Oxirgi ko'rganlari")}>
                {d.recent.length === 0 ? (
                  <EmptyLine text={tr("30 kunda kabinetga kirmagan")} />
                ) : (
                  (allRecent ? d.recent : d.recent.slice(0, 12)).map((v) => {
                    const meta = PAGE_META[v.page];
                    return (
                      <InfoRow
                        key={v.id}
                        icon={meta?.icon ?? Eye}
                        tint={meta?.tint ?? "gray"}
                        title={v.childName ? `${tr(meta?.label ?? v.page)} · ${tr(v.childName)}` : tr(meta?.label ?? v.page)}
                        subtitle={formatWhen(v.startedAt)}
                        value={formatDuration(v.durationSec, tr)}
                      />
                    );
                  })
                )}
              </IosGroup>

              {d.recent.length > 12 && (
                <div className="-mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setAllRecent((v) => !v)}
                    className="h-9 rounded-full px-4 text-[14px] font-medium text-[var(--color-primary)] active:opacity-60"
                  >
                    {allRecent ? tr("Kamroq ko'rsatish") : tr("Hammasini ko'rsatish ({0})", d.recent.length)}
                  </button>
                </div>
              )}

              <IosGroup title={tr("Qurilmalar va bildirishnoma")}>
                <InfoRow
                  icon={BellRing}
                  tint={d.push.length ? "red" : "gray"}
                  title={d.push.length ? tr("Bildirishnoma yoqilgan") : tr("Bildirishnoma o'chiq")}
                  subtitle={
                    d.push.length
                      ? d.push.map((p) => deviceName(p.userAgent)).join(", ")
                      : tr("Xabar faqat kabinetga kirganda ko'rinadi")
                  }
                />
                {d.devices.map((dev, i) => (
                  <InfoRow
                    key={i}
                    icon={Smartphone}
                    tint="blue"
                    title={tr(deviceName(dev.userAgent))}
                    subtitle={tr("oxirgi kirish: {0} · {1} marta", formatAgo(dev.lastAt, tr), dev.logins)}
                  />
                ))}
                <InfoRow
                  icon={ReceiptText}
                  tint="green"
                  title={tr("To'lov cheki yuborgan")}
                  subtitle={d.receipts.lastAt ? tr("oxirgi: {0}", formatAgo(d.receipts.lastAt, tr)) : tr("90 kunda yubormagan")}
                  value={tr("{0} ta", d.receipts.count90)}
                />
              </IosGroup>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** «Ko'pincha 20:00–22:00 oralig'ida kiradi» */
function peakText(hours: number[], tr: (k: string, ...a: (string | number)[]) => string) {
  const total = hours.reduce((a, b) => a + b, 0);
  if (!total) return tr("30 kunda kirmagan.");
  let best = 0;
  let bestSum = -1;
  for (let h = 0; h < 24; h++) {
    const sum = hours[h] + hours[(h + 1) % 24];
    if (sum > bestSum) {
      bestSum = sum;
      best = h;
    }
  }
  const from = String(best).padStart(2, "0");
  const to = String((best + 2) % 24).padStart(2, "0");
  return tr("Ko'pincha {0}:00–{1}:00 oralig'ida kiradi.", from, to);
}

function EmptyLine({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-[14px] text-[#8e8e93]">{text}</div>;
}

function InfoRow({
  icon,
  tint,
  title,
  subtitle,
  value,
}: {
  icon: AnyIcon;
  tint: IosTint;
  title: string;
  subtitle?: string;
  value?: ReactNode;
}) {
  return (
    <div className="group/row relative flex min-h-[56px] items-center gap-3 px-4 py-2.5">
      <IosIcon icon={icon} tint={tint} size={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-[var(--color-text)]">{title}</span>
        {subtitle && <span className="block truncate text-[12.5px] text-[#8e8e93]">{subtitle}</span>}
      </span>
      {value !== undefined && (
        <span className="shrink-0 text-right text-[14px] font-semibold tabular-nums text-[var(--color-text)]">{value}</span>
      )}
      <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
    </div>
  );
}

function LinkRow({
  href,
  leading,
  title,
  subtitle,
  trailing,
  separatorLeft,
}: {
  href: string;
  leading: ReactNode;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
  separatorLeft: number;
}) {
  return (
    <div className="group/row relative">
      <Link href={href} className={clsx("flex min-h-[64px] items-center gap-3 py-2.5 pl-4 pr-3", ROW_PRESS)}>
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-medium text-[var(--color-text)]">{title}</span>
          <span className="block truncate text-[13px] text-[#8e8e93]">{subtitle}</span>
        </span>
        {trailing}
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c7c7cc]" strokeWidth={2.2} aria-hidden="true" />
      </Link>
      <span className={ROW_SEPARATOR} style={{ left: separatorLeft }} aria-hidden="true" />
    </div>
  );
}
