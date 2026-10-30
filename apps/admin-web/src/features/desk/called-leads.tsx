"use client";

import { useQuery } from "@tanstack/react-query";
import { PhoneCall } from "lucide-react";
import { api } from "@/lib/api";
import { Group, ListRow } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { ErrorState, SkeletonRows } from "@/components/ios/states";
import { IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import type { CalledLeadsResult } from "./shared";
import { useTr } from "@/i18n/tr";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );

/**
 * "Qo'ng'iroq qilinganlar" — oxirgi 30 kunda javob olingan arizalar (sayt
 * arizalari ham). Bosilsa CRM'dagi ariza sahifasi ochiladi (bosqich, izoh).
 */
export function CalledLeadsList({ slug }: { slug: string }) {
  const tr = useTr();
  const query = useQuery({
    queryKey: ["desk-calls", slug, "leads-called"],
    queryFn: () => api.get<CalledLeadsResult>("/app/desk/calls/leads-called"),
  });
  const items = query.data?.items ?? [];

  if (query.isLoading) return <SkeletonRows rows={2} />;
  if (query.isError && !query.data) {
    return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }
  if (items.length === 0) return null;

  return (
    <Group
      title={
        <>
          {tr("Qo'ng'iroq qilingan arizalar")} <span className="tabular-nums">· {items.length}</span>
        </>
      }
      footer={tr("Oxirgi 30 kun. Bosilsa — CRM'dagi ariza ochiladi.")}
    >
      {items.map((item) => (
        <ListRow
          key={item.leadId}
          href={`/${slug}/crm/${item.leadId}`}
          avatar={<IosIcon icon={PhoneCall} tint="green" size={44} />}
          title={item.title}
          subtitle={[item.phone, item.calledByName, formatDateTime(item.calledAt), item.note].filter(Boolean).join(" · ")}
          meta={item.source === "WEBSITE" ? <Pill color={IOS.blue}>{tr("Sayt")}</Pill> : undefined}
          chevron
        />
      ))}
    </Group>
  );
}
