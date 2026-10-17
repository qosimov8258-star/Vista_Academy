"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { getPaginated } from "@/lib/api";
import type { NotificationLog, NotificationStatus } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDateTime } from "@/lib/format";
import { IosButton } from "@/components/ios/button";
import { Segmented } from "@/components/ios/form";
import { Group as IosGroup, ListRow } from "@/components/ios/group";
import { BellIcon, PlusIcon } from "@/components/ios/icons";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSection } from "@/components/ios/sheet";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { BroadcastModal } from "@/features/notifications/broadcast-modal";
import { CreateNotificationModal } from "@/features/notifications/create-notification-modal";
import { MarkSentModal } from "@/features/notifications/mark-sent-modal";
import { CHANNEL_LABEL, EVENT_META } from "@/features/notifications/shared";
import { useBranchContext } from "@/lib/use-branch-context";
import { isCallOperatorUser } from "@/lib/employee-position";
import { canWriteOperational } from "@/lib/permissions";
import { useTr } from "@/i18n/tr";

type StatusFilter = NotificationStatus | "ALL";

export default function NotificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [markSentOpen, setMarkSentOpen] = useState(false);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId, base } = useBranchContext(slug);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", slug, page, status, forcedBranchId],
    queryFn: () =>
      getPaginated<NotificationLog>(
        `/app/notifications?page=${page}&limit=20${status !== "ALL" ? `&status=${status}` : ""}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`,
      ),
    placeholderData: (prev) => prev,
  });

  const setStatusFilter = (value: StatusFilter) => {
    setStatus(value);
    setPage(1);
  };

  const rows = notificationsQuery.data?.data ?? [];
  const meta = notificationsQuery.data?.meta;
  const opened = rows.find((n) => n.id === openId) ?? null;
  // Call operator bola sahifasiga kira olmaydi — faqat ismi
  const childLinkAllowed = !isCallOperatorUser(user);

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <div className="mx-auto w-full max-w-4xl space-y-5 pb-2">
        <PageHeaderCard
          icon={BellIcon}
          tint="orange"
          title={tr("Bildirishnomalar")}
          count={meta ? tr("{0} ta", meta.total) : undefined}
          subtitle={tr("Ota-onalarga xabarlar jurnali")}
          actions={
            canWrite ? (
              <>
                <IosButton label={tr("Ommaviy xabar")} icon={Megaphone} compact onClick={() => setBroadcastOpen(true)} />
                <IosButton label={tr("Yangi yozuv")} icon={PlusIcon} variant="primary" compact onClick={() => setCreateOpen(true)} />
              </>
            ) : undefined
          }
        />

        {!canWrite && <ViewOnlyNote role={user?.role} />}

        <div className="max-w-md">
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatusFilter}
            label={tr("Holat")}
            options={[
              { value: "ALL", label: tr("Barchasi") },
              { value: "PENDING", label: tr("Kutilmoqda") },
              { value: "SENT", label: tr("Yuborildi") },
            ]}
          />
        </div>

        <IosGroup
          refreshing={notificationsQuery.isFetching && !notificationsQuery.isLoading}
          footer={tr("Ota-onalarga yuborilgan yoki yuborilishi kerak bo'lgan xabarlar jurnali — haqiqiy SMS/Telegram yuborilmaydi, faqat yozib boriladi. Xabar berilgach, tegishli yozuvni \"Yuborildi\" deb belgilang.")}
          bare
        >
          {notificationsQuery.isLoading ? (
            <SkeletonRows rows={6} />
          ) : notificationsQuery.isError ? (
            <ErrorState message={(notificationsQuery.error as Error).message} onRetry={() => notificationsQuery.refetch()} retrying={notificationsQuery.isFetching} />
          ) : rows.length === 0 ? (
            <EmptyState icon={BellIcon} title="Bildirishnoma topilmadi" hint={canWrite ? "Yangi yozuv qo'shish uchun tugmani bosing" : undefined} />
          ) : (
            <div className={GROUP_BLOCK}>
              {rows.map((n) => {
                const event = EVENT_META[n.eventType];
                return (
                  <ListRow
                    key={n.id}
                    onClick={() => setOpenId(n.id)}
                    avatar={<IosIcon icon={event.icon} tint={event.tint} size={40} />}
                    title={
                      <>
                        {tr(n.recipientName)}
                        <span className="font-normal text-[#8e8e93] max-sm:hidden"> · {tr(event.label)}</span>
                      </>
                    }
                    subtitle={n.message ? tr(n.message) : formatDateTime(n.createdAt)}
                    meta={
                      <span className="flex flex-col items-end gap-1">
                        <Pill color={n.status === "SENT" ? IOS.green : IOS.orange}>{n.status === "SENT" ? tr("Yuborildi") : tr("Kutilmoqda")}</Pill>
                        <span className="whitespace-nowrap text-[12px] tabular-nums text-[#8e8e93] max-sm:hidden">{formatDateTime(n.createdAt)}</span>
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </IosGroup>

        {meta && meta.total > meta.limit && (
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-[12.5px] tabular-nums text-[#8e8e93]">
              {tr("Jami")} {tr(meta.total)} {tr("ta,")} {tr(meta.page)}
              {tr("-sahifa")}
            </span>
            <div className="flex gap-2">
              <IosButton label={tr("Oldingi")} className="h-9 px-4 text-[14px]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
              <IosButton label={tr("Keyingi")} className="h-9 px-4 text-[14px]" disabled={page * meta.limit >= meta.total} onClick={() => setPage((p) => p + 1)} />
            </div>
          </div>
        )}
      </div>

      {/* Yozuv tafsiloti — «Yuborildi deb belgilash» shu yerda (qatorda tugma yo'q) */}
      <IosSheet
        open={opened !== null}
        onClose={() => setOpenId(null)}
        cancelLabel="Yopish"
        title={opened ? tr(EVENT_META[opened.eventType].label) : ""}
        footer={
          opened && canWrite && opened.status === "PENDING" ? (
            <SheetPrimaryButton onClick={() => setMarkSentOpen(true)}>{tr("Yuborildi deb belgilash")}</SheetPrimaryButton>
          ) : undefined
        }
      >
        {opened && (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <IosIcon icon={EVENT_META[opened.eventType].icon} tint={EVENT_META[opened.eventType].tint} size={56} />
              <Pill color={opened.status === "SENT" ? IOS.green : IOS.orange}>{opened.status === "SENT" ? tr("Yuborildi") : tr("Kutilmoqda")}</Pill>
            </div>
            <SheetSection>
              <SheetRow label={tr("Qabul qiluvchi")}>
                <span className="text-[var(--color-text)]">{tr(opened.recipientName)}</span>
              </SheetRow>
              {opened.recipientContact && (
                <SheetRow label={tr("Telefon")}>
                  <a href={`tel:${opened.recipientContact}`} className="tabular-nums text-[var(--color-primary)]">
                    {opened.recipientContact}
                  </a>
                </SheetRow>
              )}
              {opened.child && (
                <SheetRow label={tr("Bola")}>
                  {childLinkAllowed ? (
                    <a href={`${base}/children/${opened.child.id}`} className="text-[var(--color-primary)]">
                      {tr(opened.child.fullName)}
                    </a>
                  ) : (
                    <span className="text-[var(--color-text)]">{tr(opened.child.fullName)}</span>
                  )}
                </SheetRow>
              )}
              <SheetRow label={tr("Yaratildi")}>
                <span className="tabular-nums">{formatDateTime(opened.createdAt)}</span>
              </SheetRow>
              {opened.sentAt && (
                <SheetRow label={tr("Yuborildi")}>
                  <span className="tabular-nums">
                    {formatDateTime(opened.sentAt)}
                    {opened.channel ? ` · ${tr(CHANNEL_LABEL[opened.channel])}` : ""}
                  </span>
                </SheetRow>
              )}
            </SheetSection>
            {opened.message && (
              <SheetSection title={tr("Xabar")}>
                <p className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-snug text-[var(--color-text)]">{tr(opened.message)}</p>
              </SheetSection>
            )}
          </>
        )}
      </IosSheet>

      {canWrite && <CreateNotificationModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
      {canWrite && <BroadcastModal open={broadcastOpen} onClose={() => setBroadcastOpen(false)} slug={slug} />}
      {canWrite && (
        <MarkSentModal open={markSentOpen} onClose={() => setMarkSentOpen(false)} slug={slug} notification={opened} onDone={() => setOpenId(null)} />
      )}
    </div>
  );
}
