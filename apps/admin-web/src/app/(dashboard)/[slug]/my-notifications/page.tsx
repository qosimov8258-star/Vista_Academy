"use client";

import { use } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { EmployeeNotification } from "@/lib/types";
import { BellIcon, CalendarIcon } from "@/components/ios/icons";
import { ErrorState } from "@/components/ios/states";
import { IosIcon } from "@/features/director/ios-icon";
import { useAuth } from "@/lib/use-auth";
import { isChef } from "@/lib/permissions";
import { EmptyRow, Group, GroupAction, LargeTitle, SkeletonRows, TeacherPage } from "@/features/teacher/teacher-ui";
import styles from "@/features/teacher/teacher.module.css";
import { useTr } from "@/i18n/tr";

const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
const TZ = "Asia/Tashkent";

/** Toshkent vaqtida "YYYY-MM-DD" */
function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

/** iOS «Xabarlar»dagidek qisqa vaqt: bugun — "14:20", kecha — "Kecha", aks holda "3-noy" */
function shortTime(iso: string, tr: (s: string, ...a: (string | number)[]) => string): string {
  const d = new Date(iso);
  const now = new Date();
  const key = dayKey(d);
  if (key === dayKey(now)) {
    return new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  }
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return tr("Kecha");
  const [y, m, day] = key.split("-").map(Number);
  const label = `${day}-${tr(MONTHS_SHORT[m - 1])}`;
  return y === Number(dayKey(now).slice(0, 4)) ? label : `${label} ${y}`;
}

/**
 * Xodimning xabarlari (tarbiyachi va oshpaz) — iOS ro'yxati: yangilari
 * alohida bo'limda, oldida tizim rangidagi nuqta; bosilsa o'qilgan bo'ladi.
 * Telefonda tab panelidan ochiladi, matn qirqilmaydi.
 */
export default function MyNotificationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Oshpazga dars jadvali haqida emas, rahbariyat yuborgan xabarlar keladi
  const chef = isChef(user?.role);

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
  const unread = notifications.filter((n) => !n.isRead);
  const read = notifications.filter((n) => n.isRead);
  const footer = chef
    ? tr("Rahbariyat sizga yuborgan xabarlar shu yerga tushadi.")
    : tr("Dars jadvalingiz belgilanganda yoki o'zgarganda shu yerga xabar tushadi.");

  const renderRows = (list: EmployeeNotification[]) =>
    list.map((n, i) => (
      <NotificationRow
        key={n.id}
        notification={n}
        first={i === 0}
        chef={chef}
        time={shortTime(n.createdAt, tr)}
        pending={markReadMutation.isPending && markReadMutation.variables === n.id}
        onRead={() => markReadMutation.mutate(n.id)}
      />
    ));

  return (
    <TeacherPage>
      <LargeTitle
        icon={BellIcon}
        tint="red"
        title={tr("Xabarlar")}
        subtitle={
          notificationsQuery.data
            ? unread.length > 0
              ? tr("{0} ta o'qilmagan", unread.length)
              : notifications.length > 0
                ? tr("Hammasi o'qilgan")
                : footer
            : undefined
        }
      />

      {notificationsQuery.isLoading ? (
        <Group>
          <SkeletonRows rows={4} />
        </Group>
      ) : notificationsQuery.isError && !notificationsQuery.data ? (
        <ErrorState
          message={tr((notificationsQuery.error as Error).message)}
          onRetry={() => notificationsQuery.refetch()}
          retrying={notificationsQuery.isFetching}
        />
      ) : notifications.length === 0 ? (
        <Group footer={footer}>
          <EmptyRow
            icon={BellIcon}
            title={tr("Hozircha xabar yo'q")}
            description={chef ? tr("Sizga xabar yuborilganda shu yerda ko'rinadi") : tr("Sizga dars jadvali belgilanganda shu yerda ko'rinadi")}
          />
        </Group>
      ) : (
        <>
          {unread.length > 0 && (
            <Group
              title={tr("Yangi")}
              action={
                <GroupAction onClick={() => !markAllReadMutation.isPending && markAllReadMutation.mutate()}>
                  {tr(markAllReadMutation.isPending ? "Belgilanmoqda…" : "Hammasini o'qish")}
                </GroupAction>
              }
              footer={read.length === 0 ? footer : tr("Xabarni bossangiz — o'qilgan bo'ladi.")}
            >
              {renderRows(unread)}
            </Group>
          )}
          {read.length > 0 && (
            <Group title={tr(unread.length > 0 ? "Avvalgilar" : "So'nggi")} footer={footer}>
              {renderRows(read)}
            </Group>
          )}
        </>
      )}
    </TeacherPage>
  );
}

/**
 * Bitta xabar: 30px plitka, to'liq matn (qirqilmaydi), o'ngda vaqt. Yangisi
 * qalin va o'ngida tizim rangidagi nuqta — bosilsa o'qilgan bo'ladi.
 */
function NotificationRow({
  notification: n,
  first,
  chef,
  time,
  pending,
  onRead,
}: {
  notification: EmployeeNotification;
  first: boolean;
  chef: boolean;
  time: string;
  pending: boolean;
  onRead: () => void;
}) {
  const tr = useTr();
  return (
    <button
      type="button"
      disabled={n.isRead || pending}
      onClick={onRead}
      aria-label={n.isRead ? undefined : tr("O'qilgan deb belgilash")}
      className={clsx("relative flex min-h-[56px] w-full items-start gap-3 px-4 py-3 text-left", !n.isRead && styles.pressable, !n.isRead && "cursor-pointer")}
    >
      {!first && <span className="absolute left-[58px] right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
      <IosIcon icon={chef ? BellIcon : CalendarIcon} tint={n.isRead ? "gray" : chef ? "red" : "orange"} size={30} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={clsx(
              "min-w-0 flex-1 whitespace-pre-line break-words text-[15.5px] leading-snug text-[var(--color-text)]",
              !n.isRead && "font-semibold",
            )}
          >
            {tr(n.message)}
          </span>
          <span className="shrink-0 text-[13px] tabular-nums text-[#8e8e93]">{time}</span>
        </span>
      </span>
      {!n.isRead && (
        <span
          className={clsx("mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-primary)]", pending && "animate-pulse opacity-50")}
          aria-label={tr("O'qilmagan")}
        />
      )}
    </button>
  );
}
