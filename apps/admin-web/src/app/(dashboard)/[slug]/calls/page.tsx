"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CallsList } from "@/features/desk/calls-list";
import { CALL_KIND_LABEL, todayTashkent, type CallKind, type CallsResult } from "@/features/desk/shared";
import { useTr } from "@/i18n/tr";

export default function CallsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const [filter, setFilter] = useState<CallKind | "ALL">("ALL");
  const query = useQuery({
    queryKey: ["desk-calls", slug, todayTashkent()],
    queryFn: () => api.get<CallsResult>(`/app/desk/calls?date=${todayTashkent()}`),
  });
  const count = (k: CallKind) => query.data?.items.filter((i) => i.kind === k && !i.done).length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">{tr("Bugun qo'ng'iroq qilish")}</h1>
        <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
          {tr("Muddati o'tgan qarzdorlar, bugun kelmagan bolalar, bog'lanish kerak bo'lgan arizalar va soxta to'lov cheki yuborgan ota-onalar")}
          {query.data ? ` · ochiq: ${query.data.open}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant={filter === "ALL" ? "primary" : "outline"} size="sm" onClick={() => setFilter("ALL")}>
          {tr("Hammasi")}
        </Button>
        {(["DEBT", "ABSENT", "LEAD", "FAKE_RECEIPT"] as const).map((k) => (
          <Button key={k} variant={filter === k ? "primary" : "outline"} size="sm" onClick={() => setFilter(k)}>
            {tr(CALL_KIND_LABEL[k])} ({count(k)})
          </Button>
        ))}
      </div>
      <CallsList slug={slug} filter={filter} />
    </div>
  );
}
