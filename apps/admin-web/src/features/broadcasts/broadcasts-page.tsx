"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IdCard, Megaphone, UsersRound } from "lucide-react";
import { api, getPaginated } from "@/lib/api";
import type { BroadcastDetail, BroadcastSummary } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { IosButton } from "@/components/ios/button";
import { Segmented } from "@/components/ios/form";
import { Group as IosGroup, ListRow } from "@/components/ios/group";
import { PhoneIcon, PlusIcon } from "@/components/ios/icons";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { IosSheet, SheetRow, SheetSection } from "@/components/ios/sheet";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { BroadcastCompose, MessagePreview } from "./broadcast-compose";
import { useTr } from "@/i18n/tr";

const PAGE_SIZE = 20;

function ReadPill({ read, total }: { read: number; total: number }) {
  const tr = useTr();
  const color = total > 0 && read >= total ? IOS.green : read > 0 ? IOS.blue : IOS.gray;
  return (
    <Pill color={color} title={tr("O'qiganlar")}>
      <span className="tabular-nums">
        {read}/{total}
      </span>
    </Pill>
  );
}

/**
 * Xabar yuborish — rahbariyat ota-onalarga va xodimlarga yozgan xabarlar
 * tarixi: har birida «o'qidi M / N»; bosilsa — kim o'qigani, kim o'qimagani
 * (o'qimaganlar tepada, qo'ng'iroq qilish uchun telefoni bilan).
 * Super Admin faqat ko'radi, yuborish — filial admini va administratorda.
 */
export function BroadcastsPage({ slug }: { slug: string }) {
  const tr = useTr();
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [page, setPage] = useState(1);
  const [composeOpen, setComposeOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["broadcasts", slug, page, forcedBranchId],
    queryFn: () => getPaginated<BroadcastSummary>(`/app/broadcasts?page=${page}&limit=${PAGE_SIZE}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`),
    placeholderData: (prev) => prev,
  });
  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;
  // Super Admin tarmoq bo'ylab ko'rganda filial nomi ham kerak
  const showBranch = !user?.branchId && !forcedBranchId;

  return (
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-2">
        <PageHeaderCard
          icon={Megaphone}
          tint="indigo"
          title={tr("Xabar yuborish")}
          count={meta ? tr("{0} ta", meta.total) : undefined}
          subtitle={tr("Ota-onalar va xodimlarga xabarlar")}
          actions={canWrite ? <IosButton label={tr("Yangi xabar")} icon={PlusIcon} variant="primary" compact onClick={() => setComposeOpen(true)} /> : undefined}
        />

        <IosGroup
          refreshing={listQuery.isFetching && !listQuery.isLoading}
          footer={tr("Ota-onaga xabar kabinetiga tushadi va telefoniga bildirishnoma boradi; tarbiyachi va oshpaz — «Xabarlar» sahifasida ko'radi. «O'qidi» — xabarni ochganlar soni.")}
          bare
        >
          {listQuery.isLoading ? (
            <SkeletonRows rows={5} />
          ) : listQuery.isError && !listQuery.data ? (
            <ErrorState message={tr((listQuery.error as Error).message)} onRetry={() => listQuery.refetch()} retrying={listQuery.isFetching} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Megaphone} title="Hali xabar yuborilmagan" hint={canWrite ? "«Yangi xabar» tugmasini bosing — ota-onalarga yoki xodimlarga yozing" : undefined} />
          ) : (
            <div className={GROUP_BLOCK}>
              {rows.map((b) => (
                <ListRow
                  key={b.id}
                  onClick={() => setOpenId(b.id)}
                  avatar={<IosIcon icon={b.audience === "GUARDIANS" ? UsersRound : IdCard} tint={b.audience === "GUARDIANS" ? "orange" : "indigo"} size={40} />}
                  title={b.title}
                  subtitle={[tr(b.audience === "GUARDIANS" ? "Ota-onalar" : "Xodimlar"), tr(b.scopeLabel), showBranch ? tr(b.branch.name) : null, formatDateTime(b.createdAt)].filter(Boolean).join(" · ")}
                  meta={
                    <span className="flex flex-col items-end gap-1">
                      <ReadPill read={b.readCount} total={b.recipientCount} />
                      {b.isMandatory && <span className="text-[11.5px] font-semibold text-[#ff3b30]">{tr("Majburiy")}</span>}
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </IosGroup>

        {meta && meta.total > meta.limit && (
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-[12.5px] tabular-nums text-[#8e8e93]">{tr("{0}-sahifa", meta.page)}</span>
            <div className="flex gap-2">
              <IosButton label={tr("Oldingi")} className="h-9 px-4 text-[14px]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
              <IosButton label={tr("Keyingi")} className="h-9 px-4 text-[14px]" disabled={page * meta.limit >= meta.total} onClick={() => setPage((p) => p + 1)} />
            </div>
          </div>
        )}
      </div>

      <BroadcastDetailSheet id={openId} onClose={() => setOpenId(null)} />
      {canWrite && <BroadcastCompose open={composeOpen} onClose={() => setComposeOpen(false)} slug={slug} />}
    </div>
  );
}

function BroadcastDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const tr = useTr();
  const [tab, setTab] = useState<"unread" | "read">("unread");
  const query = useQuery({
    queryKey: ["broadcast", id],
    queryFn: () => api.get<BroadcastDetail>(`/app/broadcasts/${id}`),
    enabled: !!id,
    // Ochiq turganda o'qiganlar soni o'zi yangilanib turadi
    refetchInterval: 30_000,
  });
  const b = query.data && query.data.id === id ? query.data : undefined;
  const unread = b?.recipients.filter((r) => !r.readAt) ?? [];
  const read = b?.recipients.filter((r) => r.readAt) ?? [];
  const list = tab === "unread" ? unread : read;
  const pct = b && b.recipientCount > 0 ? Math.round((b.readCount / b.recipientCount) * 100) : 0;

  return (
    <IosSheet
      open={id !== null}
      onClose={() => {
        onClose();
        setTab("unread");
      }}
      cancelLabel="Yopish"
      title={tr("Xabar")}
    >
      {!b ? (
        query.isError ? (
          <ErrorState message={tr((query.error as Error).message)} onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : (
          <SkeletonRows rows={3} />
        )
      ) : (
        <>
          <MessagePreview title={b.title} body={b.body} mandatory={b.isMandatory} />

          {/* O'qilganlik */}
          <div className={`${GROUP_BLOCK} px-4 py-4`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] text-[#8e8e93]">{tr("O'qidi")}</p>
              <p className="text-[13px] tabular-nums text-[#8e8e93]">{pct}%</p>
            </div>
            <p className="mt-0.5 text-[28px] font-bold leading-tight tabular-nums text-[var(--color-text)]">
              {b.readCount}
              <span className="text-[17px] font-semibold text-[#8e8e93]"> / {b.recipientCount}</span>
            </p>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#767680]/[0.12]">
              <div className="h-full rounded-full bg-[#34c759] transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <SheetSection>
            <SheetRow label={tr("Kimga")}>
              <span className="text-[var(--color-text)]">
                {tr(b.audience === "GUARDIANS" ? "Ota-onalar" : "Xodimlar")} · {tr(b.scopeLabel)}
              </span>
            </SheetRow>
            <SheetRow label={tr("Yubordi")}>{b.sentBy?.fullName ?? "—"}</SheetRow>
            <SheetRow label={tr("Vaqti")}>
              <span className="tabular-nums">{formatDateTime(b.createdAt)}</span>
            </SheetRow>
            <SheetRow label={tr("Filial")}>{tr(b.branch.name)}</SheetRow>
          </SheetSection>

          <section className="space-y-2">
            <Segmented<"unread" | "read">
              value={tab}
              onChange={setTab}
              label={tr("Qabul qiluvchilar")}
              options={[
                { value: "unread", label: tr("O'qimagan · {0}", unread.length) },
                { value: "read", label: tr("O'qigan · {0}", read.length) },
              ]}
            />
            <div className={GROUP_BLOCK}>
              {list.length === 0 ? (
                <p className="px-4 py-5 text-center text-[14px] text-[#8e8e93]">{tab === "unread" ? tr("Hamma o'qidi") : tr("Hali hech kim o'qimadi")}</p>
              ) : (
                list.map((r) => (
                  <div key={r.id} className="group/row relative flex min-h-[56px] items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] text-[var(--color-text)]">{r.name}</span>
                      <span className="block truncate text-[12.5px] text-[#8e8e93]">
                        {[r.note ? tr(r.note) : null, !r.hasCabinet ? tr("kabinet ochilmagan") : null, r.readAt ? formatDateTime(r.readAt) : null].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                    {r.phone && !r.readAt && (
                      <a
                        href={`tel:${r.phone}`}
                        aria-label={tr("Qo'ng'iroq qilish")}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#34c759]/[0.12] text-[#34c759] transition-transform active:scale-90"
                      >
                        <PhoneIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                      </a>
                    )}
                    <span className={ROW_SEPARATOR} aria-hidden="true" />
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </IosSheet>
  );
}
