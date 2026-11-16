"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, ImageOff, Info } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { GalleryItem, Group } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useAuthedImage } from "@/components/ui/child-photo";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { FormSection } from "@/components/ios/form";
import { GROUP_BLOCK, ROW_SEPARATOR } from "@/components/ios/tokens";
import { PhotoPicker } from "@/features/useful/photo-picker";
import { DeleteActionRow, FormError, GroupPickerRow, InputRow } from "@/features/useful/useful-parts";
import { useTr } from "@/i18n/tr";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** Surat almashtirilmaydi (faqat nomi) — manzil o'zgarmas, kesh xavfsiz */
export function galleryImageUrl(id: string): string {
  return `${API_URL}/app/gallery/${id}/image`;
}

/** Suratning o'zi: yuklanguncha kulrang plitka, xato bo'lsa belgi */
function GalleryImage({ id, alt, fit, className }: { id: string; alt: string; fit: "cover" | "contain"; className?: string }) {
  const { src, failed } = useAuthedImage(galleryImageUrl(id));
  return (
    <div className={clsx("relative overflow-hidden bg-[#767680]/[0.12]", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob manzil
        <img src={src} alt={alt} className={clsx("h-full w-full", fit === "cover" ? "object-cover" : "object-contain")} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-[#c7c7cc]">
          {failed ? <ImageOff className="h-7 w-7" strokeWidth={1.9} /> : <span className="h-full w-full animate-pulse bg-[#767680]/[0.06]" />}
        </span>
      )}
    </div>
  );
}

/** To'rdagi bitta ish: kvadrat surat + nomi, guruh va ♥ soni */
export function GalleryTile({ item, onOpen }: { item: GalleryItem; onOpen: () => void }) {
  const tr = useTr();
  const name = item.title?.trim() || tr("Nomsiz ish");
  return (
    <button type="button" onClick={onOpen} className="group min-w-0 text-left transition-transform active:scale-[0.97]">
      <GalleryImage id={item.id} alt={name} fit="cover" className="aspect-square w-full rounded-[16px]" />
      <span className={clsx("mt-1.5 block truncate px-0.5 text-[14.5px] font-medium leading-snug", item.title?.trim() ? "text-[var(--color-text)]" : "text-[#8e8e93]")}>
        {tr(name)}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 px-0.5 text-[12.5px] text-[#8e8e93]">
        <span className="min-w-0 flex-1 truncate">{tr(item.group.name)}</span>
        <Heart className="h-3.5 w-3.5 shrink-0 fill-[#ff2d55] text-[#ff2d55]" strokeWidth={2} aria-hidden="true" />
        <span className="shrink-0 tabular-nums">{item.likesCount}</span>
        <span className="sr-only">{tr("yoqtirgan")}</span>
      </span>
    </button>
  );
}

/** To'r skeleti — haqiqiy plitkalar o'lchamida */
export function GallerySkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i}>
          <span className="block aspect-square w-full animate-pulse rounded-[16px] bg-[#767680]/[0.12]" />
          <span className="mt-2 block h-3.5 w-3/5 animate-pulse rounded-full bg-[#767680]/[0.12]" />
          <span className="mt-1.5 block h-3 w-2/5 animate-pulse rounded-full bg-[#767680]/[0.08]" />
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  const tr = useTr();
  return (
    <div className="group/row relative flex min-h-[48px] items-center gap-3 px-4">
      <span className="shrink-0 py-3 text-[15px] text-[var(--color-text)]">{tr(label)}</span>
      <span className="min-w-0 flex-1 truncate py-3 text-right text-[15px] text-[#8e8e93]">{children}</span>
      <span className={ROW_SEPARATOR} aria-hidden="true" />
    </div>
  );
}

/**
 * Ishni ko'rish: katta surat, nomi (huquqi borga tahrirlanadi — tepada
 * «Saqlash»), guruh, kim yuklagani, sana, yoqtirishlar va o'chirish
 * (varaq ichida ikkinchi bosqich).
 */
export function GalleryViewSheet({
  item,
  open,
  onClose,
  canEdit,
  slug,
}: {
  item: GalleryItem;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  slug: string;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(item.title ?? "");

  useEffect(() => {
    if (open) setTitle(item.title ?? "");
  }, [open, item.id, item.title]);

  const rename = useMutation({
    mutationFn: () => api.patch<GalleryItem>(`/app/gallery/${item.id}`, { title: title.trim() || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gallery", slug] }),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/app/gallery/${item.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery", slug] });
      onClose();
    },
  });
  const { reset: resetRename } = rename;
  const { reset: resetRemove } = remove;
  useEffect(() => {
    if (open) {
      resetRename();
      resetRemove();
    }
  }, [open, item.id, resetRename, resetRemove]);

  const dirty = canEdit && title.trim() !== (item.title ?? "").trim();
  const busy = rename.isPending || remove.isPending;
  const name = item.title?.trim() || tr("Nomsiz ish");

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      cancelLabel="Yopish"
      title={tr(name)}
      action={dirty ? { label: "Saqlash", onClick: () => !rename.isPending && rename.mutate(), loading: rename.isPending } : undefined}
    >
      <GalleryImage id={item.id} alt={name} fit="contain" className="aspect-square max-h-[60dvh] w-full rounded-[18px] bg-white" />

      {canEdit && (
        <SheetSection footer={rename.isError ? <span className="text-[#ff3b30]">{tr(rename.error instanceof ApiError ? rename.error.message : "Saqlab bo'lmadi")}</span> : undefined}>
          <InputRow label="Nomi" value={title} onChange={setTitle} placeholder="Masalan, Quyoshli uy" maxLength={80} />
        </SheetSection>
      )}

      <SheetSection title={tr("Ma'lumot")}>
        <InfoRow label="Guruh">{tr(item.group.name)}</InfoRow>
        <InfoRow label="Yuklagan">{tr(item.createdBy.fullName)}</InfoRow>
        <InfoRow label="Sana">{formatDate(item.createdAt)}</InfoRow>
        <InfoRow label="Yoqtirishlar">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Heart className="h-4 w-4 fill-[#ff2d55] text-[#ff2d55]" strokeWidth={2} aria-hidden="true" />
            {item.likesCount}
          </span>
        </InfoRow>
      </SheetSection>

      {canEdit && (
        <SheetSection title={tr("Amallar")}>
          <DeleteActionRow
            noun="rasm"
            onDelete={() => remove.mutate()}
            deleting={remove.isPending}
            deleteError={remove.isError ? (remove.error instanceof ApiError ? remove.error.message : "O'chirib bo'lmadi") : null}
            resetKey={`${open}-${item.id}`}
          />
        </SheetSection>
      )}
    </IosSheet>
  );
}

/** Yangi ish yuklash: surat, guruh (majburiy), ixtiyoriy nomi */
export function GalleryAddSheet({
  open,
  onClose,
  slug,
  groups,
  defaultGroupId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  /** Filtrda tanlangan guruh — oldindan tanlanadi */
  defaultGroupId: string;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [image, setImage] = useState<string | null>(null);
  const [groupId, setGroupId] = useState("");
  const [title, setTitle] = useState("");
  const [tried, setTried] = useState(false);

  // Bitta guruh bo'lsa (odatda tarbiyachi) — o'zi tanlanadi
  const onlyGroupId = groups.length === 1 ? groups[0].id : "";
  useEffect(() => {
    if (!open) return;
    setImage(null);
    setTitle("");
    setTried(false);
    setGroupId(defaultGroupId || onlyGroupId);
  }, [open, defaultGroupId, onlyGroupId]);

  const errors = {
    image: !image ? "Suratni tanlang" : undefined,
    group: !groupId ? "Guruhni tanlang" : undefined,
  };
  const valid = !errors.image && !errors.group;

  const save = useMutation({
    mutationFn: () => api.post<GalleryItem>("/app/gallery", { groupId, title: title.trim() || undefined, image }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery", slug] });
      onClose();
    },
  });
  const { reset } = save;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const submit = () => {
    setTried(true);
    if (!valid || save.isPending) return;
    save.mutate();
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !save.isPending && onClose()}
      title={tr("Rasm qo'shish")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={save.isPending} dim={!valid}>
          {tr("Yuklash")}
        </SheetPrimaryButton>
      }
    >
      <div className={clsx(GROUP_BLOCK, "flex items-start gap-3 px-4 py-3.5")}>
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#007aff]" strokeWidth={2} aria-hidden="true" />
        <p className="text-[13.5px] leading-snug text-[var(--color-text)]/80">
          {tr("Bolalarning yuzi tushmagan surat yuklang — galereyani bog'chadagi barcha ota-onalar ko'radi.")}
        </p>
      </div>

      <FormSection>
        <PhotoPicker
          src={image}
          onPicked={setImage}
          onRemove={() => setImage(null)}
          aspect="square"
          emptyTitle="Suratni tanlang"
          emptyHint="Rasm, applikatsiya yoki loydan yasalgan ish — yorug' joyda, tekis suratga oling"
          error={tried ? errors.image : undefined}
          alt={tr("Tanlangan surat")}
        />
      </FormSection>

      <FormSection footer={tr("Nomi bo'lmasa ham bo'ladi.")}>
        <GroupPickerRow
          groups={groups}
          value={groupId}
          onChange={setGroupId}
          allowWholeBranch={false}
          error={tried ? errors.group : undefined}
          footer="Qaysi guruh bolalarining ishi. Galereyani filialdagi barcha ota-onalar ko'radi."
        />
        <InputRow label="Nomi" value={title} onChange={setTitle} placeholder="Masalan, Quyoshli uy" maxLength={80} />
      </FormSection>

      <FormError message={save.error ? (save.error instanceof ApiError ? save.error.message : "Kutilmagan xatolik yuz berdi") : null} />
    </IosSheet>
  );
}
