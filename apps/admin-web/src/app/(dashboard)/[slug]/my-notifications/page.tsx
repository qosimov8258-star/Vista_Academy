"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { EmployeeNotification } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { BellIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";

export default function MyNotificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["employee-notifications", slug],
    queryFn: () => api.get<EmployeeNotification[]>("/app/employee-notifications"),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/app/employee-notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-notifications", slug] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch("/app/employee-notifications/read-all", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee-notifications", slug] }),
  });

  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">
            Bildirishnomalarim
          </h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            Dars jadvalingiz belgilanganda yoki o&apos;zgarganda shu yerga xabar tushadi
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => markAllReadMutation.mutate()} loading={markAllReadMutation.isPending}>
            Barchasini o&apos;qilgan deb belgilash
          </Button>
        )}
      </div>

      {notificationsQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : notificationsQuery.isError ? (
        <ErrorState message={(notificationsQuery.error as Error).message} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<BellIcon className="h-[26px] w-[26px]" />}
          title="Hozircha bildirishnoma yo'q"
          description="Sizga dars jadvali belgilanganda shu yerda ko'rinadi"
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`flex items-start gap-3 p-4 ${!notification.isRead ? "border-[var(--color-primary)]/30" : ""}`}
            >
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${
                  notification.isRead
                    ? "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]"
                    : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                }`}
              >
                <BellIcon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-text)]">{notification.message}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatDateTime(notification.createdAt)}</p>
              </div>
              {!notification.isRead && (
                <button
                  type="button"
                  onClick={() => markReadMutation.mutate(notification.id)}
                  className="shrink-0 cursor-pointer text-[12.5px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  O&apos;qildi
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
