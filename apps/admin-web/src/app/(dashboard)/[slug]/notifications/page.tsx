"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getPaginated } from "@/lib/api";
import type { NotificationEventType, NotificationLog, NotificationStatus } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDateTime } from "@/lib/format";
import { CreateNotificationModal } from "@/features/notifications/create-notification-modal";
import { MarkSentModal } from "@/features/notifications/mark-sent-modal";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";

const eventTypeLabels: Record<NotificationEventType, string> = {
  CHILD_ABSENT: "Bola kelmadi",
  DAILY_REPORT_READY: "Kundalik hisobot tayyor",
  PAYMENT_DUE: "To'lov muddati",
  PAYMENT_OVERDUE: "To'lov kechikdi",
  VACCINATION_DUE: "Vaksinatsiya muddati",
  QUARANTINE_ALERT: "Karantin xabari",
  LEAD_FOLLOW_UP: "Ariza bo'yicha aloqa",
  CUSTOM: "Boshqa",
};

const channelLabels: Record<string, string> = {
  SMS: "SMS",
  TELEGRAM: "Telegram",
  EMAIL: "Email",
  PHONE_CALL: "Telefon qo'ng'iroq",
  IN_APP: "Ilova ichida",
};

const statusFilters: { value: NotificationStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Barchasi" },
  { value: "PENDING", label: "Kutilmoqda" },
  { value: "SENT", label: "Yuborildi" },
];

export default function NotificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<NotificationStatus | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [markSentTarget, setMarkSentTarget] = useState<NotificationLog | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", slug, page, status, forcedBranchId],
    queryFn: () =>
      getPaginated<NotificationLog>(
        `/app/notifications?page=${page}&limit=20${status !== "ALL" ? `&status=${status}` : ""}${forcedBranchId ? `&branchId=${forcedBranchId}` : ""}`,
      ),
    placeholderData: (prev) => prev,
  });

  const setStatusFilter = (value: NotificationStatus | "ALL") => {
    setStatus(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Bildirishnomalar</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Ota-onalarga yuborilgan yoki yuborilishi kerak bo&apos;lgan xabarlar jurnali — haqiqiy SMS/Telegram
            yuborilmaydi, faqat yozib boriladi. Xabar berilgach, tegishli yozuvni &quot;Yuborildi&quot; deb belgilang.
          </p>
        </div>
        {canWrite && <Button onClick={() => setCreateOpen(true)}>+ Yangi yozuv</Button>}
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      <div className="flex gap-2">
        {statusFilters.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={status === f.value ? "primary" : "secondary"}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {notificationsQuery.isLoading ? (
        <LoadingState />
      ) : notificationsQuery.isError ? (
        <ErrorState message={(notificationsQuery.error as Error).message} />
      ) : !notificationsQuery.data || notificationsQuery.data.data.length === 0 ? (
        <EmptyState
          title="Bildirishnoma topilmadi"
          description={canWrite ? "Yangi yozuv qo'shish uchun tugmani bosing" : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-gray-50 text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Hodisa</th>
                  <th className="px-5 py-3 font-medium">Qabul qiluvchi</th>
                  <th className="px-5 py-3 font-medium">Xabar</th>
                  <th className="px-5 py-3 font-medium">Bola</th>
                  <th className="px-5 py-3 font-medium">Holat</th>
                  <th className="px-5 py-3 font-medium">Yaratildi</th>
                  <th className="px-5 py-3 font-medium">Yuborildi</th>
                  {canWrite && <th className="px-5 py-3 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {notificationsQuery.data.data.map((n) => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-[var(--color-text)]">{eventTypeLabels[n.eventType]}</td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">
                      <div className="font-medium text-[var(--color-text)]">{n.recipientName}</div>
                      {n.recipientContact && <div className="text-xs">{n.recipientContact}</div>}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">
                      <span className="block max-w-xs truncate" title={n.message}>
                        {n.message}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">
                      {n.child ? (
                        <Link href={`/${slug}/children/${n.child.id}`} className="text-[var(--color-primary)] hover:underline">
                          {n.child.fullName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={n.status === "SENT" ? "success" : "warning"}>
                        {n.status === "SENT" ? "Yuborildi" : "Kutilmoqda"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">{formatDateTime(n.createdAt)}</td>
                    <td className="px-5 py-3 text-[var(--color-text-muted)]">
                      {n.sentAt ? (
                        <>
                          {formatDateTime(n.sentAt)}
                          {n.channel && <div className="text-xs">{channelLabels[n.channel]}</div>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3">
                        {n.status === "PENDING" && (
                          <Button size="sm" variant="secondary" onClick={() => setMarkSentTarget(n)}>
                            Yuborildi deb belgilash
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-text-muted)]">
            <span>
              Jami {notificationsQuery.data.meta.total} ta, {notificationsQuery.data.meta.page}-sahifa
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Oldingi
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * notificationsQuery.data.meta.limit >= notificationsQuery.data.meta.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Keyingi
              </Button>
            </div>
          </div>
        </Card>
      )}

      {canWrite && <CreateNotificationModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
      {canWrite && (
        <MarkSentModal
          open={!!markSentTarget}
          onClose={() => setMarkSentTarget(null)}
          slug={slug}
          notification={markSentTarget}
        />
      )}
    </div>
  );
}
