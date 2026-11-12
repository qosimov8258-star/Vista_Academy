"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import { BellIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";
import { EmptyCard, ListSkeleton, LoadErrorCard, formatUzDate } from "../foydali/ui";
import { useMarkParentMessageRead, useParentMessages } from "../use-messages";
import { useTr } from "@/i18n/tr";

function timeLabel(iso: string, tr: (s: string) => string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return tr("Kecha");
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return tr(formatUzDate(local));
}

/**
 * Xabarlar — bog'cha rahbariyati yuborgan e'lon va xabarlar. Yangilari
 * belgilangan; bosilsa matn to'liq ochiladi va «o'qildi» bo'ladi
 * (rahbariyat kim o'qiganini ko'radi).
 */
export default function ParentMessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useParentMessages(slug);
  const read = useMarkParentMessageRead(slug);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (query.isError && query.error instanceof ApiError && query.error.status === 401) {
      router.replace(`/ota-ona/${slug}/kirish`);
    }
  }, [query.isError, query.error, router, slug]);

  const readAll = useMutation({
    mutationFn: () => parentApi.patch("/app/parent/messages/read-all", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["parent-messages", slug] }),
  });

  const items = query.data;
  const unread = items?.filter((m) => !m.readAt).length ?? 0;
  const toggle = (id: string, isRead: boolean) => {
    setOpenId((current) => (current === id ? null : id));
    if (!isRead) read.mutate(id);
  };

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className={`${styles.roundedFont} text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--p-ink)]`}>{tr("Xabarlar")}</h1>
          <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--p-muted)]">
            {unread > 0 ? tr("{0} ta yangi xabar", unread) : tr("Bog'cha yuborgan e'lon va xabarlar")}
          </p>
        </div>
        {unread > 1 && (
          <button
            type="button"
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending}
            className="shrink-0 rounded-full bg-[var(--p-card)] px-3.5 py-2 text-[13.5px] font-semibold text-[var(--p-ink)] shadow-[var(--p-shadow)] transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            {tr("Hammasini o'qish")}
          </button>
        )}
      </header>

      {!items ? (
        query.isError ? (
          <LoadErrorCard error={query.error} onRetry={() => query.refetch()} loginHref={`/ota-ona/${slug}/kirish`} />
        ) : (
          <ListSkeleton rows={3} />
        )
      ) : items.length === 0 ? (
        <EmptyCard Icon={BellIcon} tone="sky" title={tr("Hozircha xabar yo'q")} text={tr("Bog'cha e'lon yoki xabar yuborsa, shu yerda paydo bo'ladi va telefoningizga bildirishnoma keladi.")} />
      ) : (
        <ul className="mt-5 space-y-3 pb-6">
          {items.map((m) => {
            const isRead = !!m.readAt;
            const open = openId === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => toggle(m.id, isRead)}
                  aria-expanded={open}
                  className="w-full rounded-[var(--p-radius)] bg-[var(--p-card)] p-4 text-left shadow-[var(--p-shadow)] transition-transform active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={clsx(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
                        m.isMandatory ? "bg-[var(--p-coral)]/15 text-[var(--p-coral)]" : "bg-[var(--p-sky)]/15 text-[var(--p-sky-ink)]",
                      )}
                      aria-hidden="true"
                    >
                      <BellIcon className="h-[22px] w-[22px]" filled={!isRead} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className={clsx("min-w-0 flex-1 break-words text-[16px] leading-snug text-[var(--p-ink)]", isRead ? "font-semibold" : "font-extrabold")}>{m.title}</p>
                        <span className="shrink-0 text-[12.5px] tabular-nums text-[var(--p-muted)]">{timeLabel(m.createdAt, tr)}</span>
                      </div>
                      <p className={clsx("mt-1 whitespace-pre-line break-words text-[14.5px] leading-relaxed text-[var(--p-muted)]", !open && "line-clamp-2")}>{m.body}</p>
                      <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-[var(--p-muted)]">
                        <span className="truncate">{m.from}</span>
                        {m.isMandatory && <span className="shrink-0 font-bold text-[var(--p-coral)]">{tr("Muhim")}</span>}
                        {!isRead && <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--p-coral)]" aria-label={tr("Yangi")} />}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
