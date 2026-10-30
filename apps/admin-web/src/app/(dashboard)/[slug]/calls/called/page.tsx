"use client";

import { use, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PhoneOutgoing, RefreshCw } from "lucide-react";
import { IosButton } from "@/components/ios/button";
import { PageHeaderCard } from "@/components/ios/page-card";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { CalledLeadsList, useCalledLeads } from "@/features/desk/called-leads";
import { useTr } from "@/i18n/tr";

/**
 * Qo'ng'iroq qilinganlar — «Qo'ng'iroqlar»dan alohida bo'lim: operator
 * javob olgan arizalar (saytdan kelganlari ham), kim va qachon qo'ng'iroq
 * qilgani bilan. Bugungi qo'ng'iroq ro'yxati esa «Qo'ng'iroqlar»da qoladi.
 */
export default function CalledLeadsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const query = useCalledLeads(slug);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => queryClient.refetchQueries({ queryKey: ["desk-calls", slug, "leads-called"] });
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={refresh} />
      <div className="mx-auto w-full max-w-3xl space-y-5 pb-2">
        <PageHeaderCard
          icon={PhoneOutgoing}
          tint="teal"
          title={tr("Qo'ng'iroq qilinganlar")}
          count={query.data ? tr("{0} ta", query.data.items.length) : undefined}
          subtitle={tr("Oxirgi 30 kunda javob olingan arizalar")}
          actions={<IosButton label={tr("Yangilash")} icon={RefreshCw} compact onClick={onRefresh} loading={refreshing} />}
        />

        <CalledLeadsList slug={slug} />
      </div>
    </div>
  );
}
