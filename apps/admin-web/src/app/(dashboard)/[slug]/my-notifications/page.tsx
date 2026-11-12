"use client";

import { use, useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { EmployeeNotification, InboxMessage } from "@/lib/types";
import { Send } from "lucide-react";
import { BellIcon, CalendarIcon } from "@/components/ios/icons";
import { ErrorState } from "@/components/ios/states";
import { IosSheet, SheetSection } from "@/components/ios/sheet";
import { useEmployeeInbox } from "@/features/broadcasts/use-inbox";
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

/** Ro'yxatdagi bitta xabar — tizim bildirishnomasi yoki rahbariyat yuborgan xabar */
interface Item {
  key: string;
  id: string;
  kind: "system" | "message";
  title?: string;
  text: string;
  isRead: boolean;
  isMandatory: boolean;
  createdAt: string;
}

/**
 * Xodimning xabarlari (tarbiyachi va oshpaz) — iOS ro'yxati: yangilari
 * alohida bo'limda, oldida tizim rangidagi nuqta; bosilsa o'qilgan bo'ladi.
 * Ikki manba bitta ro'yxatda: tizim bildirishnomalari (dars jadvali) va
 * rahbariyat «Xabar yuborish» orqali yozgan xabarlar — ular bosilsa to'liq
 * matni varaqda ochiladi.
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

  const inboxQuery = useEmployeeInbox(slug);
  const readMessageMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/app/broadcasts/inbox/${id}/read`, {}),
    onSuccess: (_res, id) =>
      queryClient.setQueryData<InboxMessage[]>(["broadcast-inbox", slug], (list) => list?.map((m) => (m.id === id ? { ...m, readAt: new Date().toISOString() } : m))),
  });

  // Ikkala manba ham; majburiy xabarlar faqat ochib o'qilganda belgilanadi
  const markAllReadMutation = useMutation({
    mutationFn: () =>
      Promise.all([
        api.patch("/app/employee-notifications/read-all", {}),
        inboxQuery.data?.some((m) => !m.readAt) ? api.patch("/app/broadcasts/inbox/read-all", {}) : Promise.resolve(null),
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-notifications", slug] });
      queryClient.invalidateQueries({ queryKey: ["broadcast-inbox", slug] });
    },
  });

  const [openKey, setOpenKey] = useState<string | null>(null);

  const notifications: Item[] = [
    ...(notificationsQuery.data ?? []).map((n): Item => ({
      key: `n:${n.id}`,
      id: n.id,
      kind: "system",
      text: n.message,
      isRead: n.isRead,
      isMandatory: false,
      createdAt: n.createdAt,
    })),
    ...(inboxQuery.data ?? []).map((m): Item => ({
      key: `m:${m.id}`,
      id: m.id,
      kind: "message",
      title: m.title,
      text: m.body,
      isRead: !!m.readAt,
      isMandatory: m.isMandatory,
      createdAt: m.createdAt,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notifications.filter((n) => !n.isRead);
  const read = notifications.filter((n) => n.isRead);
  const opened = notifications.find((n) => n.key === openKey) ?? null;

  const openItem = (item: Item) => {
    if (item.kind === "system") {
      markReadMutation.mutate(item.id);
      return;
    }
    setOpenKey(item.key);
    if (!item.isRead) readMessageMutation.mutate(item.id);
  };
  const footer = chef
    ? tr("Rahbariyat sizga yuborgan xabarlar shu yerga tushadi.")
    : tr("Dars jadvali o'zgarganda va rahbariyat xabar yuborganda shu yerga tushadi.");

  const renderRows = (list: Item[]) =>
    list.map((n, i) => (
      <NotificationRow
        key={n.key}
        item={n}
        first={i === 0}
        chef={chef}
        time={shortTime(n.createdAt, tr)}
        pending={
          n.kind === "system"
            ? markReadMutation.isPending && markReadMutation.variables === n.id
            : readMessageMutation.isPending && readMessageMutation.variables === n.id
        }
        onOpen={() => openItem(n)}
      />
    ));

  return (
    <TeacherPage>
      <LargeTitle
        icon={BellIcon}
        tint="red"
        title={tr("Xabarlar")}
        subtitle={
          notificationsQuery.data || inboxQuery.data
            ? unread.length > 0
              ? tr("{0} ta o'qilmagan", unread.length)
              : notifications.length > 0
                ? tr("Hammasi o'qilgan")
                : footer
            : undefined
        }
      />

      {notificationsQuery.isLoading && inboxQuery.isLoading ? (
        <Group>
          <SkeletonRows rows={4} />
        </Group>
      ) : notificationsQuery.isError && !notificationsQuery.data && !inboxQuery.data ? (
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

      {/* Rahbariyat xabari — to'liq matn */}
      <IosSheet open={opened !== null} onClose={() => setOpenKey(null)} cancelLabel="Yopish" title={tr("Xabar")}>
        {opened && (
          <>
            <div className="flex flex-col items-center gap-2 pt-1 text-center">
              <IosIcon icon={Send} tint={opened.isMandatory ? "red" : "blue"} size={56} />
              <p className="break-words text-[20px] font-bold leading-tight text-[var(--color-text)]">{opened.title}</p>
              <p className="text-[13px] text-[#8e8e93]">
                {(inboxQuery.data ?? []).find((m) => m.id === opened.id)?.from} · {shortTime(opened.createdAt, tr)}
              </p>
            </div>
            <SheetSection>
              <p className="whitespace-pre-line break-words px-4 py-3.5 text-[15.5px] leading-relaxed text-[var(--color-text)]">{opened.text}</p>
            </SheetSection>
          </>
        )}
      </IosSheet>
    </TeacherPage>
  );
}

/**
 * Bitta xabar: 30px plitka, to'liq matn (qirqilmaydi), o'ngda vaqt. Yangisi
 * qalin va o'ngida tizim rangidagi nuqta — bosilsa o'qilgan bo'ladi.
 */
function NotificationRow({
  item: n,
  first,
  chef,
  time,
  pending,
  onOpen,
}: {
  item: Item;
  first: boolean;
  chef: boolean;
  time: string;
  pending: boolean;
  onOpen: () => void;
}) {
  const tr = useTr();
  const message = n.kind === "message";
  // Rahbariyat xabari doim bosiladi (to'liq matn ochiladi); tizim xabari — faqat o'qilmaganda
  const pressable = message || !n.isRead;
  return (
    <button
      type="button"
      disabled={!pressable || pending}
      onClick={onOpen}
      aria-label={message ? undefined : n.isRead ? undefined : tr("O'qilgan deb belgilash")}
      className={clsx("relative flex min-h-[56px] w-full items-start gap-3 px-4 py-3 text-left", pressable && styles.pressable, pressable && "cursor-pointer")}
    >
      {!first && <span className="absolute left-[58px] right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
      <IosIcon
        icon={message ? Send : chef ? BellIcon : CalendarIcon}
        tint={message ? (n.isRead ? "gray" : n.isMandatory ? "red" : "blue") : n.isRead ? "gray" : chef ? "red" : "orange"}
        size={30}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={clsx(
              "min-w-0 flex-1 break-words text-[15.5px] leading-snug text-[var(--color-text)]",
              !message && "whitespace-pre-line",
              !n.isRead && "font-semibold",
            )}
          >
            {message ? n.title : tr(n.text)}
          </span>
          <span className="shrink-0 text-[13px] tabular-nums text-[#8e8e93]">{time}</span>
        </span>
        {message && <span className="mt-0.5 line-clamp-2 block break-words text-[14px] leading-snug text-[#8e8e93]">{n.text}</span>}
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
