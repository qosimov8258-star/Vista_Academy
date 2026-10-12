"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Baby, Inbox, ReceiptText, ShieldAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PhoneIcon } from "@/components/ios/icons";
import { Toast, type ToastState } from "@/components/ui/toast";
import { Group, ListRow, Row } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { FieldRow, FormSection, TextInput } from "@/components/ios/form";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";
import { CALL_KIND_LABEL, RELATION_LABEL, todayTashkent, type CallItem, type CallKind, type CallsResult } from "./shared";
import { useTr } from "@/i18n/tr";

/** Qo'ng'iroq turi — plitka rangi va belgisi (har turning o'z rangi) */
export const CALL_KIND_STYLE: Record<CallKind, { icon: AnyIcon; tint: IosTint; color: string }> = {
  DEBT: { icon: ReceiptText, tint: "red", color: IOS.red },
  ABSENT: { icon: Baby, tint: "orange", color: IOS.orange },
  LEAD: { icon: Inbox, tint: "blue", color: IOS.blue },
  FAKE_RECEIPT: { icon: ShieldAlert, tint: "pink", color: "#ff2d55" },
};

/** Ota-ona telefonni olmasa — "qo'ng'iroq qildim" o'rniga shu yozuv saqlanadi. */
const NO_ANSWER_NOTE = "Aloqa qila olmadim — telefonni olmadi";
const isNoAnswer = (note: string | null) => !!note && note.startsWith("Aloqa qila olmadim");

const contactsOf = (item: CallItem) =>
  item.contacts && item.contacts.length > 0 ? item.contacts : item.phone ? [{ name: item.contactName, relation: null, phone: item.phone }] : [];

/**
 * Bugun qo'ng'iroq qilish ro'yxati — iOS uslubida. Qatorda tugma yo'q:
 * qator bosilsa varaq ochiladi (ota-onaga qo'ng'iroq, izoh, "Qo'ng'iroq
 * qildim" / "Aloqa qila olmadim", bajarilganini "Qaytarish").
 *
 * `limit` berilsa faqat tepadagi ochiq qo'ng'iroqlar bitta blokda
 * (bosh sahifalar uchun); aks holda "Ochiq" va "Bajarildi" bo'limlari.
 */
export function CallsList({ slug, limit, filter }: { slug: string; limit?: number; filter?: CallKind | "ALL" }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const date = todayTashkent();
  const [target, setTarget] = useState<CallItem | null>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  const query = useQuery({
    queryKey: ["desk-calls", slug, date],
    queryFn: () => api.get<CallsResult>(`/app/desk/calls?date=${date}`),
    refetchInterval: 60_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["desk-calls", slug] });
  const fail = (err: unknown) => setToast({ type: "error", message: tr(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi") });

  const done = useMutation({
    mutationFn: ({ item, noAnswer }: { item: CallItem; noAnswer?: boolean }) =>
      api.post("/app/desk/calls/done", {
        kind: item.kind,
        subjectId: item.subjectId,
        date,
        note: noAnswer ? NO_ANSWER_NOTE : note.trim() || undefined,
      }),
    onSuccess: (_, { noAnswer }) => {
      setTarget(null);
      setNote("");
      setToast({ type: "success", message: tr(noAnswer ? "Aloqa bo'lmadi deb belgilandi" : "Qo'ng'iroq belgilandi") });
      refresh();
    },
    onError: fail,
  });
  const undo = useMutation({
    mutationFn: (item: CallItem) => api.post("/app/desk/calls/undo", { kind: item.kind, subjectId: item.subjectId, date }),
    onSuccess: () => {
      setTarget(null);
      setToast({ type: "success", message: tr("Qaytarildi") });
      refresh();
    },
    onError: fail,
  });
  const busy = done.isPending || undo.isPending;

  const open = (item: CallItem) => {
    setNote("");
    setTarget(item);
  };

  const rowFor = (item: CallItem) => {
    const style = CALL_KIND_STYLE[item.kind];
    const noAnswer = isNoAnswer(item.doneNote);
    return (
      <ListRow
        key={`${item.kind}-${item.subjectId}`}
        onClick={() => open(item)}
        avatar={<IosIcon icon={style.icon} tint={style.tint} size={44} />}
        title={tr(item.title)}
        subtitle={
          item.done
            ? [tr(noAnswer ? "Aloqa bo'lmadi" : "Qo'ng'iroq qilindi"), item.calledByName, !noAnswer ? item.doneNote : null].filter(Boolean).join(" · ")
            : tr(item.subtitle)
        }
        meta={
          item.done ? (
            <Pill color={noAnswer ? IOS.orange : IOS.green}>{tr(noAnswer ? "Javobsiz" : "Bajarildi")}</Pill>
          ) : item.badge ? (
            <Pill color={style.color}>{tr(item.badge)}</Pill>
          ) : contactsOf(item).length === 0 ? (
            <Pill color={IOS.orange}>{tr("Raqam yo'q")}</Pill>
          ) : undefined
        }
      />
    );
  };

  let body;
  if (query.isLoading) {
    body = <SkeletonRows rows={limit ? Math.min(limit, 4) : 5} />;
  } else if (query.isError && !query.data) {
    body = <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  } else {
    const all = (query.data?.items ?? []).filter((i) => !filter || filter === "ALL" || i.kind === filter);
    const openItems = all.filter((i) => !i.done);
    const doneItems = all.filter((i) => i.done);
    if (limit) {
      const shown = openItems.slice(0, limit);
      body =
        shown.length === 0 ? (
          <EmptyState icon={PhoneIcon} title="Bugun qo'ng'iroq qilish kerak emas" />
        ) : (
          <div className={GROUP_BLOCK}>{shown.map(rowFor)}</div>
        );
    } else if (all.length === 0) {
      body = <EmptyState icon={PhoneIcon} title={filter && filter !== "ALL" ? "Bu turda qo'ng'iroq yo'q" : "Ro'yxat bo'sh"} hint="Bugun qo'ng'iroq qilish kerak bo'lganlar shu yerda chiqadi" />;
    } else {
      body = (
        <div className="space-y-5">
          <Group
            title={
              <>
                {tr("Ochiq")} <span className="tabular-nums">· {openItems.length}</span>
              </>
            }
            refreshing={query.isFetching && !query.isLoading}
            bare={openItems.length === 0}
          >
            {openItems.length === 0 ? (
              <div className={GROUP_BLOCK}>
                <Row
                  leading={<IosIcon icon={PhoneIcon} tint="green" size={30} />}
                  title={tr("Hammasi bajarildi")}
                  subtitle={tr("Bugungi qo'ng'iroqlar tugadi")}
                />
              </div>
            ) : (
              openItems.map(rowFor)
            )}
          </Group>
          {doneItems.length > 0 && (
            <Group
              title={
                <>
                  {tr("Bajarildi")} <span className="tabular-nums">· {doneItems.length}</span>
                </>
              }
            >
              {doneItems.map(rowFor)}
            </Group>
          )}
        </div>
      );
    }
  }

  const t = target;
  const style = t ? CALL_KIND_STYLE[t.kind] : null;
  const contacts = t ? contactsOf(t) : [];
  const tNoAnswer = t ? isNoAnswer(t.doneNote) : false;

  return (
    <>
      {body}

      <IosSheet
        open={t !== null}
        onClose={() => !busy && setTarget(null)}
        cancelLabel="Yopish"
        title={t ? tr(t.title) : ""}
        footer={
          t &&
          (t.done ? (
            <SheetSecondaryButton onClick={() => !busy && undo.mutate(t)}>{undo.isPending ? tr("Qaytarilmoqda…") : tr("Qaytarish")}</SheetSecondaryButton>
          ) : (
            <div className="flex gap-2.5">
              <div className="flex-1">
                <SheetSecondaryButton onClick={() => !busy && done.mutate({ item: t, noAnswer: true })}>
                  {done.isPending && done.variables?.noAnswer ? tr("Saqlanmoqda…") : tr("Aloqa qila olmadim")}
                </SheetSecondaryButton>
              </div>
              <div className="flex-1">
                <SheetPrimaryButton onClick={() => !busy && done.mutate({ item: t })} loading={done.isPending && !done.variables?.noAnswer}>
                  {tr("Qo'ng'iroq qildim")}
                </SheetPrimaryButton>
              </div>
            </div>
          ))
        }
      >
        {t && style && (
          <>
            <div className="flex flex-col items-center gap-2 pt-1 text-center">
              <IosIcon icon={style.icon} tint={style.tint} size={48} />
              <div className="flex flex-wrap justify-center gap-1.5">
                <Pill color={style.color}>{tr(CALL_KIND_LABEL[t.kind])}</Pill>
                {t.badge && <Pill color={IOS.red}>{tr(t.badge)}</Pill>}
              </div>
              <p className="max-w-[420px] text-[13px] leading-snug text-[#8e8e93]">{tr(t.subtitle)}</p>
            </div>

            <SheetSection title={tr("Aloqa")}>
              {contacts.length === 0 ? (
                <Row
                  leading={<IosIcon icon={PhoneIcon} tint="gray" size={30} />}
                  title={<span className="text-[#ff9500]">{tr("Ota-ona raqami kiritilmagan")}</span>}
                />
              ) : (
                contacts.map((c, i) => (
                  <Row
                    key={`${c.phone}-${i}`}
                    href={c.phone ? `tel:${c.phone}` : undefined}
                    leading={<IosIcon icon={PhoneIcon} tint="green" size={30} />}
                    title={[c.relation ? (RELATION_LABEL[c.relation] ?? c.relation) : null, c.name].filter(Boolean).join(" · ") || tr("Ota-ona")}
                    value={c.phone ? <span className="font-medium text-[var(--color-primary)]">{c.phone}</span> : undefined}
                  />
                ))
              )}
            </SheetSection>

            {t.done ? (
              <SheetSection title={tr("Natija")}>
                <SheetRow label={tr("Holat")}>
                  <Pill color={tNoAnswer ? IOS.orange : IOS.green}>{tr(tNoAnswer ? "Aloqa bo'lmadi" : "Qo'ng'iroq qilindi")}</Pill>
                </SheetRow>
                {t.calledByName && <SheetRow label={tr("Kim")}>{t.calledByName}</SheetRow>}
                {t.doneNote && !tNoAnswer && (
                  <SheetRow label={tr("Izoh")}>
                    <span className="block whitespace-normal break-words text-left">{t.doneNote}</span>
                  </SheetRow>
                )}
              </SheetSection>
            ) : (
              <FormSection title={tr("Natija")} footer={tr("Izoh «Qo'ng'iroq qildim» bilan birga saqlanadi")}>
                <FieldRow label={tr("Izoh")} htmlFor="call-note">
                  <TextInput
                    id="call-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !busy) done.mutate({ item: t });
                    }}
                    placeholder={tr("Masalan: ertaga to'laydi")}
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                </FieldRow>
              </FormSection>
            )}
          </>
        )}
      </IosSheet>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
