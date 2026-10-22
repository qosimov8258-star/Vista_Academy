"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { canWriteTeaching } from "@/lib/permissions";
import { Group, Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import type { ChildReminder } from "./child-note-modal";
import { useTr } from "@/i18n/tr";

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });

/** Bugungi eslatmalar (dori vaqti va h.k.) — filial bo'yicha, tarbiyachida faqat o'z guruhi. */
export function TodayRemindersCard({ slug, branchId, today }: { slug: string; branchId: string; today: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // Belgini tarbiyachi (yoki admin) qo'yadi; oshpaz faqat ko'radi —
  // canWriteTeaching unga yolg'on qaytaradi
  const canMark = canWriteTeaching(user?.role);
  const [openId, setOpenId] = useState<string | null>(null);
  const doneMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.post(`/app/reminders/${id}/done`, { done }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-reminders", slug] });
      queryClient.invalidateQueries({ queryKey: ["child-reminders", slug] });
      setOpenId(null);
    },
  });
  const query = useQuery({
    queryKey: ["today-reminders", slug, branchId, today],
    queryFn: () => api.get<ChildReminder[]>(`/app/reminders?date=${today}&branchId=${branchId}`),
    refetchInterval: 60_000,
  });

  if (query.isLoading) return <SkeletonRows rows={2} />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  if (!query.data?.length) return null;
  const opened = query.data.find((r) => r.id === openId) ?? null;

  return (
    <>
      <Group title={tr("Bugungi eslatmalar")} footer={canMark ? tr("Eslatmani bosib, berilganini belgilang.") : undefined} bare>
        <div className={GROUP_BLOCK}>
          {query.data.map((r) => (
            <Row
              key={r.id}
              onClick={canMark ? () => setOpenId(r.id) : undefined}
              leading={<IosIcon icon={AlarmClock} tint={r.doneAt ? "gray" : "orange"} size={30} />}
              title={
                <span className={r.doneAt ? "text-[#8e8e93] line-through" : undefined}>
                  {r.time && <b className="mr-1.5 tabular-nums">{r.time}</b>}
                  {tr(r.childName)}
                  {r.groupName && <span className="font-normal text-[#8e8e93]"> · {tr(r.groupName)}</span>}
                </span>
              }
              subtitle={tr(r.text)}
              value={r.doneAt ? <Pill color={IOS.green}>{tr("Berildi")} {timeOf(r.doneAt)}</Pill> : <Pill color={IOS.orange}>{tr("Kutilmoqda")}</Pill>}
            />
          ))}
        </div>
      </Group>

      <IosSheet
        open={!!opened}
        onClose={() => !doneMutation.isPending && setOpenId(null)}
        cancelLabel="Yopish"
        title={tr("Eslatma")}
        footer={
          opened && canMark ? (
            opened.doneAt ? (
              <SheetSecondaryButton onClick={() => doneMutation.mutate({ id: opened.id, done: false })}>{tr("Qaytarish (berilmadi)")}</SheetSecondaryButton>
            ) : (
              <SheetPrimaryButton loading={doneMutation.isPending} onClick={() => doneMutation.mutate({ id: opened.id, done: true })}>
                {tr("Berildi deb belgilash")}
              </SheetPrimaryButton>
            )
          ) : undefined
        }
      >
        {opened && (
          <>
            <SheetSection>
              <SheetRow label={tr("Bola")}>
                <span className="text-[var(--color-text)]">{tr(opened.childName)}</span>
              </SheetRow>
              {opened.groupName && <SheetRow label={tr("Guruh")}>{tr(opened.groupName)}</SheetRow>}
              <SheetRow label={tr("Vaqt")}>
                <span className="tabular-nums text-[var(--color-text)]">{opened.time ?? "—"}</span>
              </SheetRow>
              <SheetRow label={tr("Yozdi")}>{tr(opened.authorName)}</SheetRow>
              {opened.doneAt && (
                <SheetRow label={tr("Berildi")}>
                  <span className="text-[#248a3d]">
                    {timeOf(opened.doneAt)}
                    {opened.doneByName ? ` · ${tr(opened.doneByName)}` : ""}
                  </span>
                </SheetRow>
              )}
            </SheetSection>
            <SheetSection title={tr("Eslatma")}>
              <p className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-snug text-[var(--color-text)]">{tr(opened.text)}</p>
            </SheetSection>
            {doneMutation.isError && <p className="px-4 text-[13px] text-[#ff3b30]">{tr((doneMutation.error as Error).message)}</p>}
          </>
        )}
      </IosSheet>
    </>
  );
}
