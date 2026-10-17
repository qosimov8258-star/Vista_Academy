"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DoorOpen } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Room } from "@/lib/types";
import { IosButton } from "@/components/ios/button";
import { FieldRow, FormSection, IosSwitch, TextInput } from "@/components/ios/form";
import { Group as IosGroup, Row } from "@/components/ios/group";
import { PlusIcon } from "@/components/ios/icons";
import { Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton } from "@/components/ios/sheet";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { useTr } from "@/i18n/tr";

/**
 * Xonalar (kabinetlar) ro'yxati. Qator bosilsa — tahrirlash varag'i
 * (nomi, sig'imi, ishlatilishi, o'chirish). Xona o'chirilsa uning darslari
 * o'chmaydi — xonasiz qoladi.
 */
export function RoomsPanel({
  slug,
  rooms,
  loading,
  error,
  onRetry,
  retrying,
  canWrite,
}: {
  slug: string;
  rooms: Room[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  retrying: boolean;
  canWrite: boolean;
}) {
  const tr = useTr();
  const [sheet, setSheet] = useState<{ open: boolean; room: Room | null }>({ open: false, room: null });
  const seats = rooms.filter((room) => room.isActive).reduce((sum, room) => sum + (room.capacity ?? 0), 0);

  return (
    <>
      <IosGroup
        title={
          <>
            {tr("Xonalar")}
            {rooms.length > 0 && <span className="font-normal normal-case tracking-normal">· {rooms.length}</span>}
          </>
        }
        action={
          canWrite ? (
            <IosButton label={tr("Yangi xona")} icon={PlusIcon} className="h-8 px-3 text-[13.5px]" onClick={() => setSheet({ open: true, room: null })} />
          ) : undefined
        }
        footer={rooms.length > 0 && seats > 0 ? tr("Faol xonalarda jami {0} o'rin", seats) : undefined}
        bare
      >
        {loading ? (
          <SkeletonRows rows={3} avatar={false} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={onRetry} retrying={retrying} />
        ) : rooms.length === 0 ? (
          <EmptyState icon={DoorOpen} title="Hali xona yo'q" hint={canWrite ? "Xonalarni qo'shing — darslarni xonaga bog'lab, bir xonada ikki dars to'qnashmasligini nazorat qilasiz" : undefined} />
        ) : (
          <div className={GROUP_BLOCK}>
            {rooms.map((room) => (
              <Row
                key={room.id}
                leading={<IosIcon icon={DoorOpen} tint={room.isActive ? "indigo" : "gray"} size={30} />}
                title={tr(room.name)}
                subtitle={[room.capacity ? tr("{0} kishilik", room.capacity) : tr("Sig'imi belgilanmagan"), tr("{0} ta dars", room.lessonCount)].join(" · ")}
                value={room.isActive ? undefined : <Pill color={IOS.gray}>{tr("Ishlatilmaydi")}</Pill>}
                onClick={canWrite ? () => setSheet({ open: true, room }) : undefined}
              />
            ))}
          </div>
        )}
      </IosGroup>

      {canWrite && <RoomSheet open={sheet.open} room={sheet.room} slug={slug} onClose={() => setSheet((s) => ({ ...s, open: false }))} />}
    </>
  );
}

function RoomSheet({ open, room, slug, onClose }: { open: boolean; room: Room | null; slug: string; onClose: () => void }) {
  const tr = useTr();
  const formId = useId();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(room?.name ?? "");
    setCapacity(room?.capacity ? String(room.capacity) : "");
    setIsActive(room?.isActive ?? true);
    setError(null);
    setShowMissing(false);
    setConfirmDelete(false);
  }, [open, room]);

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ["rooms", slug] });
    queryClient.invalidateQueries({ queryKey: ["lesson-schedules", slug] });
    onClose();
  };
  const onError = (err: unknown) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), capacity: capacity ? Number(capacity) : null };
      return room ? api.patch(`/app/rooms/${room.id}`, { ...body, isActive }) : api.post("/app/rooms", { ...body, capacity: body.capacity ?? undefined });
    },
    onSuccess: done,
    onError,
  });
  const deleteMutation = useMutation({ mutationFn: () => api.delete(`/app/rooms/${room!.id}`), onSuccess: done, onError });
  const busy = saveMutation.isPending || deleteMutation.isPending;

  const footer = confirmDelete ? (
    <div className="space-y-2.5">
      <p className="rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13px] leading-snug text-[#ff3b30]">
        {room && room.lessonCount > 0
          ? tr("«{0}» o'chiriladi. Undagi {1} ta dars o'chmaydi — xonasiz qoladi.", room.name, room.lessonCount)
          : tr("«{0}» o'chiriladi.", room?.name ?? "")}
      </p>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <SheetSecondaryButton onClick={() => setConfirmDelete(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
        </div>
        <button
          type="button"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-[#ff3b30] text-[16px] font-semibold text-white transition-[transform,opacity] active:scale-[0.96] disabled:opacity-45"
        >
          {tr("O'chirish")}
        </button>
      </div>
    </div>
  ) : (
    <>
      <SheetPrimaryButton type="submit" form={formId} loading={saveMutation.isPending} dim={!name.trim()}>
        {tr("Saqlash")}
      </SheetPrimaryButton>
      {room && (
        <SheetSecondaryButton danger onClick={() => setConfirmDelete(true)}>
          {tr("Xonani o'chirish")}
        </SheetSecondaryButton>
      )}
    </>
  );

  return (
    <IosSheet open={open} onClose={() => !busy && onClose()} title={room ? tr("Xona") : tr("Yangi xona")} footer={footer}>
      <form
        id={formId}
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            setShowMissing(true);
            return;
          }
          saveMutation.mutate();
        }}
      >
        {error && (
          <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13px] leading-snug text-[#ff3b30]">
            {tr(error)}
          </p>
        )}
        <FormSection footer={tr("Guruhdagi bolalar sig'imdan ko'p bo'lsa — dars qo'yishda ogohlantiriladi")}>
          <FieldRow label={tr("Nomi")} htmlFor={`${formId}-name`} error={showMissing && !name.trim() ? "Xona nomini kiriting" : undefined}>
            <TextInput id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Masalan: 1-xona, Musiqa xonasi")} maxLength={60} className="text-right" />
          </FieldRow>
          <FieldRow label={tr("Sig'imi")} htmlFor={`${formId}-cap`}>
            <div className="flex items-baseline justify-end gap-1.5">
              <TextInput
                id={`${formId}-cap`}
                inputMode="numeric"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder={tr("Chegarasiz")}
                className="text-right tabular-nums"
              />
              {capacity && <span className="shrink-0 text-[13px] text-[#8e8e93]">{tr("bola")}</span>}
            </div>
          </FieldRow>
        </FormSection>
        {room && (
          <FormSection footer={tr("Ishlatilmayotgan xona dars qo'yishda tanlovda chiqmaydi, eski darslari saqlanadi")}>
            <FieldRow label={tr("Ishlatiladi")}>
              <div className="flex justify-end py-1.5">
                <IosSwitch checked={isActive} onChange={setIsActive} label={tr("Ishlatiladi")} />
              </div>
            </FieldRow>
          </FormSection>
        )}
      </form>
    </IosSheet>
  );
}
