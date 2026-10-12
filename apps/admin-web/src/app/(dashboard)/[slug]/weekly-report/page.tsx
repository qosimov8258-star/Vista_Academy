"use client";

import { use, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Baby, CalendarDays, ChartColumn, ClipboardCheck, IdCard, Inbox, Printer, ReceiptText, UserX, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/use-auth";
import { IosButton } from "@/components/ios/button";
import { PeriodStepper, WEEKDAYS, dayMonthLabel, shiftDay } from "@/components/ios/day-stepper";
import { Group, ListRow, Row } from "@/components/ios/group";
import { KpiCard } from "@/components/ios/kpi-card";
import { PageCard, PageHeaderCard } from "@/components/ios/page-card";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet } from "@/components/ios/sheet";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { todayTashkent, type WeeklyResult } from "@/features/desk/shared";
import { useTr } from "@/i18n/tr";

type Day = WeeklyResult["daily"][number];

/** Pul: "1 250 000" + kichikroq kulrang "so'm" */
function Money({ value }: { value: number }) {
  const tr = useTr();
  return (
    <>
      {Math.round(value).toLocaleString("ru-RU").replace(/ /g, " ")}
      <span className="ml-1 text-[15px] font-semibold text-[#8e8e93]">{tr("so'm")}</span>
    </>
  );
}

/**
 * Haftalik hisobot — iOS uslubida (CLAUDE.md). Funksiyalar avvalgidek:
 * haftalar orasida o'tish, chop etish / PDF, ko'rsatkichlar (pul
 * ko'rsatkichlari filial admini va administratorga ko'rsatilmaydi),
 * kunlar bo'yicha davomat (har kun — guruhlar kesimida), ko'p kelmagan
 * bolalar. Ekranda kun qatori bosilsa guruhlar varag'i ochiladi; chop
 * etishda esa hammasi to'liq jadval bo'lib chiqadi.
 */
export default function WeeklyReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  // Pul bilan bog'liq ko'rsatkichlar moliyachining ishi — filial admini va call operatorga ko'rsatilmaydi
  const showMoney = user?.role !== "BRANCH_ADMIN" && user?.role !== "MANAGER";
  const [today, setToday] = useState("");
  const [from, setFrom] = useState("");
  useEffect(() => {
    const t = todayTashkent();
    setToday(t);
    setFrom((f) => f || t);
  }, []);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const query = useQuery({
    queryKey: ["desk-weekly", slug, from],
    queryFn: () => api.get<WeeklyResult>(`/app/desk/weekly?from=${from}`),
    enabled: !!from,
    placeholderData: (prev) => prev,
  });
  const r = query.data;
  const loading = !from || query.isLoading;

  const year = today ? new Date(`${today}T00:00:00Z`).getUTCFullYear() : undefined;
  const weekLabel = r ? `${dayMonthLabel(r.from, tr, year)} — ${dayMonthLabel(r.to, tr, year)}` : "…";
  const isCurrentWeek = !!r && !!today && r.from <= today && today <= r.to;
  const dayName = (date: string) => tr(WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]);
  const maxDay = Math.max(1, ...(r?.daily ?? []).map((d) => d.present + d.absent + d.sick));
  const day: Day | null = r && openDay !== null ? (r.daily[openDay] ?? null) : null;

  return (
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-5xl space-y-5 pb-2">
        <div className="space-y-5 print:hidden">
          <PageHeaderCard
            icon={ChartColumn}
            tint="indigo"
            title={tr("Haftalik hisobot")}
            count={r ? weekLabel : undefined}
            subtitle={tr(showMoney ? "Direktorga: bolalar, davomat, qarz va arizalar" : "Bolalar, davomat va arizalar")}
            actions={<IosButton label={tr("Chop etish / PDF")} icon={Printer} compact onClick={() => window.print()} />}
          />
          {from && (
            <PeriodStepper
              onPrev={() => setFrom((f) => shiftDay(f, -7))}
              onNext={() => setFrom((f) => shiftDay(f, 7))}
              prevLabel={tr("Oldingi hafta")}
              nextLabel={tr("Keyingi hafta")}
              reset={r && !isCurrentWeek ? { label: tr("Shu hafta"), onClick: () => setFrom(today) } : undefined}
            >
              {weekLabel}
              {query.isFetching && !query.isLoading && <span className="ml-2 h-1.5 w-1.5 animate-pulse rounded-full bg-[#8e8e93]" aria-hidden="true" />}
            </PeriodStepper>
          )}
        </div>

        {/* Chop etishdagi sarlavha */}
        {r && (
          <h1 className="hidden text-[20px] font-bold print:block">
            {tr("Haftalik hisobot")} · {formatDate(r.from)} — {formatDate(r.to)}
          </h1>
        )}

        {query.isError && !r ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={Baby} tint="blue" label={tr("Faol bolalar")} value={loading || !r ? null : r.children} />
              <KpiCard
                icon={ClipboardCheck}
                tint="green"
                label={tr("Davomat")}
                value={loading || !r ? null : r.attendancePercent === null ? "—" : `${r.attendancePercent}%`}
                hint={tr("kelganlar ulushi")}
                progress={r?.attendancePercent ?? undefined}
                progressColor={IOS.green}
              />
              {showMoney && (
                <KpiCard icon={Wallet} tint="green" label={tr("Yig'ilgan to'lov")} value={loading || !r ? null : <Money value={r.collected} />} />
              )}
              {showMoney && (
                <KpiCard
                  icon={ReceiptText}
                  tint="red"
                  label={tr("Jami qarz")}
                  value={loading || !r ? null : <Money value={r.totalDebt} />}
                  hint={r ? tr("{0} ta qarzdor", r.debtorsCount) : undefined}
                />
              )}
              {showMoney && (
                <KpiCard
                  icon={ReceiptText}
                  tint="orange"
                  label={tr("Muddati o'tgan qarz")}
                  value={loading || !r ? null : <Money value={r.overdueDebt} />}
                  valueColor={r && r.overdueDebt > 0 ? IOS.red : undefined}
                />
              )}
              <KpiCard
                icon={Inbox}
                tint="blue"
                label={tr("Yangi arizalar")}
                value={loading || !r ? null : r.newLeads}
                hint={r ? tr("{0} tasi qabul qilindi", r.wonLeads) : undefined}
              />
              <KpiCard
                icon={IdCard}
                tint="purple"
                label={tr("Xodimlar yo'qligi")}
                value={loading || !r ? null : r.staffAbsences}
                hint={tr("kun (kelmadi/kasal/ta'til)")}
              />
            </div>

            {/* Hafta grafigi: har kun kelganlar; bugun — tizim rangida, qolgan kunlar — uning 35% i */}
            {r && r.daily.length > 0 && (
              <PageCard className="px-4 pb-3 pt-4 print:hidden">
                <p className="text-[14px] font-medium text-[#6d6d72]">{tr("Kunlar bo'yicha kelganlar")}</p>
                <div className="mt-3 grid h-32 items-end gap-2" style={{ gridTemplateColumns: `repeat(${r.daily.length}, minmax(0, 1fr))` }}>
                  {r.daily.map((d) => (
                    <div key={d.date} className="flex h-full flex-col items-center justify-end gap-1">
                      <span className="text-[11.5px] font-medium tabular-nums text-[#8e8e93]">{d.present || ""}</span>
                      <div
                        className="w-full max-w-[44px] rounded-[8px] transition-[height] duration-500"
                        style={{
                          height: `${Math.max(d.present > 0 ? 6 : 2, (d.present / maxDay) * 100)}%`,
                          backgroundColor: d.date === today ? "var(--color-primary)" : "color-mix(in srgb, var(--color-primary) 35%, transparent)",
                        }}
                        title={`${dayName(d.date)}: ${d.present}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${r.daily.length}, minmax(0, 1fr))` }}>
                  {r.daily.map((d) => (
                    <span key={d.date} className={`truncate text-center text-[11.5px] ${d.date === today ? "font-semibold text-[var(--color-text)]" : "text-[#8e8e93]"}`}>
                      {dayName(d.date).slice(0, 2)}
                    </span>
                  ))}
                </div>
              </PageCard>
            )}

            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start print:hidden">
              {/* Kunlar bo'yicha davomat — kun bosilsa guruhlar varag'i */}
              <Group title={tr("Kunlar bo'yicha davomat")} bare={loading}>
                {loading ? (
                  <SkeletonRows rows={5} />
                ) : (
                  (r?.daily ?? []).map((d, i) => (
                    <Row
                      key={d.date}
                      onClick={() => setOpenDay(i)}
                      leading={<IosIcon icon={CalendarDays} tint={d.date === today ? "accent" : "gray"} size={30} />}
                      title={`${dayName(d.date)}, ${dayMonthLabel(d.date, tr, year)}`}
                      subtitle={`${tr("Kelmadi")} ${d.absent} · ${tr("Kasal")} ${d.sick}`}
                      value={<Pill color={d.present > 0 ? IOS.green : IOS.gray}>{tr("{0} keldi", d.present)}</Pill>}
                    />
                  ))
                )}
              </Group>

              {/* Ko'p kelmagan bolalar */}
              <Group
                title={tr("Ko'p kelmagan bolalar")}
                footer={tr("Hafta davomida 2 kun va undan ko'p kelmaganlar")}
                bare={loading || !r || r.frequentlyAbsent.length === 0}
              >
                {loading ? (
                  <SkeletonRows rows={3} />
                ) : !r || r.frequentlyAbsent.length === 0 ? (
                  <EmptyState icon={UserX} title="Bunday bola yo'q" />
                ) : (
                  r.frequentlyAbsent.map((c) => (
                    <ListRow
                      key={c.name}
                      avatar={<IosAvatar name={c.name} />}
                      title={tr(c.name)}
                      meta={<Pill color={c.days >= 4 ? IOS.red : IOS.orange}>{tr("{0} kun", c.days)}</Pill>}
                    />
                  ))
                )}
              </Group>
            </div>

            {/* Chop etish uchun — hamma kunlar guruhlar kesimida va ko'p kelmaganlar to'liq */}
            {r && (
              <div className="hidden space-y-4 text-[13px] print:block">
                {r.daily.map((d, dayIndex) => (
                  <section key={d.date} className="break-inside-avoid">
                    <h3 className="border-b border-black/20 pb-1 font-semibold">
                      {dayName(d.date)}, {formatDate(d.date)} — {tr("Keldi")} {d.present} · {tr("Kelmadi")} {d.absent} · {tr("Kasal")} {d.sick}
                    </h3>
                    {r.groups.map((g) => {
                      const gd = g.daily[dayIndex];
                      return (
                        <p key={g.id} className="flex justify-between border-b border-black/10 py-1">
                          <span>
                            {tr(g.name)} ({tr("{0} ta bola", g.childrenCount)} · {g.teachers.length > 0 ? g.teachers.join(", ") : tr("Tarbiyachi biriktirilmagan")})
                          </span>
                          <span className="tabular-nums">
                            {tr("Keldi")} {gd?.present ?? 0} · {tr("Kelmadi")} {gd?.absent ?? 0} · {tr("Kasal")} {gd?.sick ?? 0}
                          </span>
                        </p>
                      );
                    })}
                  </section>
                ))}
                {r.frequentlyAbsent.length > 0 && (
                  <section className="break-inside-avoid">
                    <h3 className="border-b border-black/20 pb-1 font-semibold">{tr("Ko'p kelmagan bolalar (2 kun va undan ko'p)")}</h3>
                    {r.frequentlyAbsent.map((c) => (
                      <p key={c.name} className="flex justify-between border-b border-black/10 py-1">
                        <span>{tr(c.name)}</span>
                        <span className="tabular-nums">{tr("{0} kun", c.days)}</span>
                      </p>
                    ))}
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Kun tafsiloti — guruhlar kesimida */}
      <IosSheet open={day !== null} onClose={() => setOpenDay(null)} cancelLabel="Yopish" title={day ? `${dayName(day.date)}, ${dayMonthLabel(day.date, tr, year)}` : ""}>
        {day && r && openDay !== null && (
          <>
            <StatStrip tone="white" className="lg:grid-cols-3">
              <StatCell label={tr("Keldi")} value={day.present} color={IOS.green} />
              <StatCell label={tr("Kelmadi")} value={day.absent} color={IOS.red} />
              <StatCell label={tr("Kasal")} value={day.sick} color={IOS.orange} />
            </StatStrip>
            <section>
              <h3 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]">{tr("Guruhlar bo'yicha")}</h3>
              {r.groups.length === 0 ? (
                <EmptyState icon={ChartColumn} title="Guruh yo'q" />
              ) : (
                <div className={GROUP_BLOCK}>
                  {r.groups.map((g) => {
                    const gd = g.daily[openDay];
                    return (
                      <ListRow
                        key={g.id}
                        avatar={<IosAvatar name={tr(g.name)} letters={1} />}
                        title={tr(g.name)}
                        subtitle={`${tr("Kelmadi")} ${gd?.absent ?? 0} · ${tr("Kasal")} ${gd?.sick ?? 0} · ${g.teachers.length > 0 ? g.teachers.join(", ") : tr("Tarbiyachi biriktirilmagan")}`}
                        meta={<Pill color={(gd?.present ?? 0) > 0 ? IOS.green : IOS.gray}>{`${gd?.present ?? 0}/${g.childrenCount}`}</Pill>}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </IosSheet>
    </div>
  );
}
