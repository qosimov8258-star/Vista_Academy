"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PhoneOutgoing } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";
import { Group, ListRow } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { SearchPill } from "@/components/ios/filters";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { todayTashkent, type CalledLeadsResult } from "./shared";
import { useTr } from "@/i18n/tr";

type CalledLead = CalledLeadsResult["items"][number];

const tashkentDay = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date(value));
const tashkentTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

/** Sahifa sarlavhasidagi son ham shu so'rovdan — kalit bir xil, so'rov bir marta yuboriladi */
export function useCalledLeads(slug: string) {
  return useQuery({
    queryKey: ["desk-calls", slug, "leads-called"],
    queryFn: () => api.get<CalledLeadsResult>("/app/desk/calls/leads-called"),
    refetchInterval: 60_000,
  });
}

/**
 * "Qo'ng'iroq qilinganlar" — oxirgi 30 kunda javob olingan arizalar (sayt
 * arizalari ham), kun bo'yicha, eng yangisi tepada. Bosilsa CRM'dagi ariza
 * sahifasi ochiladi (bosqich, izoh) — faqat ariza shu filialga yozilgan
 * bo'lsa (CRM filial bo'yicha ishlaydi).
 */
export function CalledLeadsList({ slug }: { slug: string }) {
  const tr = useTr();
  const [search, setSearch] = useState("");
  const query = useCalledLeads(slug);

  const days = useMemo(() => {
    const items = query.data?.items ?? [];
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const match = (i: CalledLead) =>
      !q || i.title.toLowerCase().includes(q) || i.parentName.toLowerCase().includes(q) || (!!digits && i.phone.replace(/\D/g, "").includes(digits));
    const byDay = new Map<string, CalledLead[]>();
    for (const item of items.filter(match)) {
      const day = tashkentDay(item.calledAt);
      byDay.set(day, [...(byDay.get(day) ?? []), item]);
    }
    return [...byDay.entries()];
  }, [query.data, search]);

  if (query.isLoading) return <SkeletonRows rows={4} />;
  if (query.isError && !query.data) {
    return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={PhoneOutgoing}
        title="Hali qo'ng'iroq qilingan ariza yo'q"
        hint="«Qo'ng'iroqlar»da «Qo'ng'iroq qildim» bosilgan arizalar shu yerda chiqadi"
      />
    );
  }

  const today = todayTashkent();
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayLabel = (day: string) => (day === today ? tr("Bugun") : day === yesterday ? tr("Kecha") : formatDate(`${day}T12:00:00`));
  const canOpen = items.some((i) => i.inMyBranch);

  return (
    <div className="space-y-5">
      {items.length > 5 && <SearchPill value={search} onChange={setSearch} placeholder={tr("Ism yoki telefon")} />}
      {days.length === 0 ? (
        <EmptyState icon={PhoneOutgoing} title="Hech narsa topilmadi" />
      ) : (
        days.map(([day, rows], index) => (
          <Group
            key={day}
            title={
              <>
                {dayLabel(day)} <span className="tabular-nums">· {rows.length}</span>
              </>
            }
            refreshing={index === 0 && query.isFetching && !query.isLoading}
            footer={index === days.length - 1 && canOpen ? tr("Bosilsa — CRM'dagi ariza ochiladi.") : undefined}
          >
            {rows.map((item) => (
              <ListRow
                key={item.leadId}
                href={item.inMyBranch ? `/${slug}/crm/${item.leadId}` : undefined}
                avatar={<IosIcon icon={PhoneOutgoing} tint="teal" size={44} />}
                title={item.title}
                subtitle={[formatPhone(item.phone), item.calledByName, tashkentTime(item.calledAt), item.note].filter(Boolean).join(" · ")}
                meta={item.source === "WEBSITE" ? <Pill color={IOS.blue}>{tr("Sayt")}</Pill> : undefined}
              />
            ))}
          </Group>
        ))
      )}
    </div>
  );
}
