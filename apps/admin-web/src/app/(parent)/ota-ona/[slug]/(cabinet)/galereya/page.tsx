"use client";

import { use, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Heart, Palette, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import parentStyles from "../../parent.module.css";
import { GalleryIcon, galleryImageUrl, useParentGallery, useToggleLike, type ParentGalleryItem } from "../foydali-content";
import { EmptyCard, FoydaliHeader, ListSkeleton, LoadErrorCard, formatUzDate } from "../foydali/ui";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";
import { useTr } from "@/i18n/tr";

/** «2-guruh», «Группа Солнышко» kabi nomlarga «Guruh» qayta qo'shilmaydi */
function useGroupLabel() {
  const tr = useTr();
  return (name: string) => (/guruh|групп|group/i.test(name) ? name : tr("Guruh «{0}»", name));
}

/**
 * Bog'cha galereyasi — bolalar ishlari muzeyi. Filialdagi hamma guruhlar
 * ishlari guruh nomi bilan; ota-ona «Yoqdi» bosadi (bitta ishga bitta).
 * Rasm bosilsa butun ekranda ochiladi.
 */
export default function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const query = useParentGallery();
  const like = useToggleLike();
  const groupLabel = useGroupLabel();
  const me = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  const [group, setGroup] = useState<string | null>(null);
  const [open, setOpen] = useState<ParentGalleryItem | null>(null);

  const items = useMemo(() => query.data ?? [], [query.data]);
  // Guruhlar: o'z bolasining guruhi birinchi, qolganlari alifbo bo'yicha
  const ownGroups = new Set(me.data?.children.map((child) => child.group?.id).filter(Boolean));
  const groups = Array.from(new Map(items.map((item) => [item.groupId, item.groupName])).entries()).sort(
    ([a, nameA], [b, nameB]) => Number(ownGroups.has(b)) - Number(ownGroups.has(a)) || nameA.localeCompare(nameB),
  );
  const shown = group ? items.filter((item) => item.groupId === group) : items;
  const orgName = me.data?.parent.organizationName;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader
        title={orgName ? tr("{0} galereyasi", orgName) : tr("Galereya")}
        subtitle={tr("Bolalarimiz ijodi: rasmlar, kardon va loy ishlari")}
      />

      {query.isError && !query.data ? (
        <div className="mt-5">
          <LoadErrorCard error={query.error} onRetry={() => query.refetch()} loginHref={`/ota-ona/${slug}/kirish`} />
        </div>
      ) : query.isPending ? (
        <ListSkeleton rows={2} tall />
      ) : items.length === 0 ? (
        <EmptyCard Icon={GalleryIcon} tone="coral" title="Galereya hali bo'sh" text="Tarbiyachilar bolalar ishlarini suratga olib qo'shganda shu yerda chiqadi." />
      ) : (
        <>
          {groups.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label={tr("Guruhlar")}>
              <GroupChip active={!group} onClick={() => setGroup(null)}>
                {tr("Hammasi")}
              </GroupChip>
              {groups.map(([id, name]) => (
                <GroupChip key={id} active={group === id} onClick={() => setGroup(id)}>
                  {name}
                </GroupChip>
              ))}
            </div>
          )}

          <ul className="mt-5 space-y-4">
            {shown.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
                <div className="flex items-center gap-3 px-4 pb-3 pt-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--p-coral)]/14 text-[var(--p-coral)]">
                    <Palette className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={clsx(parentStyles.roundedFont, "truncate text-[17px] font-extrabold text-[var(--p-ink)]")}>
                      {groupLabel(item.groupName)}
                    </p>
                    <p className="truncate text-[12.5px] text-[var(--p-muted)]">{formatUzDate(item.addedAt)}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(item)} className="block w-full px-3" aria-label={tr("Kattalashtirish")}>
                  <img
                    src={galleryImageUrl(item.id)}
                    alt={item.title ?? ""}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-[18px] bg-[var(--p-sunken)] object-cover"
                  />
                </button>
                <div className="flex items-center gap-3 px-4 py-3">
                  <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--p-ink)]">{item.title ?? ""}</p>
                  <LikeButton item={item} onToggle={() => like.mutate(item.id)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {open && <Viewer item={items.find((item) => item.id === open.id) ?? open} onClose={() => setOpen(null)} onLike={(id) => like.mutate(id)} />}
    </div>
  );
}

function LikeButton({ item, onToggle, light = false }: { item: ParentGalleryItem; onToggle: () => void; light?: boolean }) {
  const tr = useTr();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={item.liked}
      aria-label={item.liked ? tr("Yoqdi — olib tashlash") : tr("Yoqdi")}
      className={clsx(
        "flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold transition-transform active:scale-90",
        light ? "bg-white/15 text-white" : item.liked ? "bg-[#ff2d55]/12 text-[#ff2d55]" : "bg-[var(--p-sunken)] text-[var(--p-muted)]",
      )}
    >
      <Heart
        key={item.liked ? "on" : "off"}
        className={clsx("h-[19px] w-[19px]", item.liked && parentStyles.starPop)}
        strokeWidth={2.2}
        fill={item.liked ? "#ff2d55" : "none"}
        color={item.liked ? "#ff2d55" : "currentColor"}
      />
      <span className="tabular-nums">{tr("Yoqdi: {0}", item.likesCount)}</span>
    </button>
  );
}

function GroupChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={clsx(
        "min-h-[36px] max-w-full truncate rounded-full px-3.5 text-[13.5px] font-semibold transition-colors",
        active ? "bg-[var(--p-coral)] text-white" : "bg-[var(--p-card)] text-[var(--p-ink)] shadow-[var(--p-shadow)]",
      )}
    >
      {children}
    </button>
  );
}

/** Butun ekranda ko'rish: qora fon, rasm sig'adi, pastda nomi va «Yoqdi» */
function Viewer({ item, onClose, onLike }: { item: ParentGalleryItem; onClose: () => void; onLike: (id: string) => void }) {
  const tr = useTr();
  const groupLabel = useGroupLabel();
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(document.body);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
  }, [onClose]);
  if (!host) return null;
  return createPortal(
    <div
      className={clsx(parentStyles.fadeIn, "fixed inset-0 z-[60] flex flex-col bg-black")}
      role="dialog"
      aria-modal="true"
      aria-label={item.title ?? tr("Rasm")}
      onClick={onClose}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex justify-end p-3">
        <button type="button" onClick={onClose} aria-label={tr("Yopish")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
          <X className="h-5 w-5" strokeWidth={2.4} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        <img src={galleryImageUrl(item.id)} alt={item.title ?? ""} className="max-h-full max-w-full rounded-[14px] object-contain" onClick={(event) => event.stopPropagation()} />
      </div>
      <div className="flex items-center gap-3 px-5 py-4" onClick={(event) => event.stopPropagation()}>
        <div className="min-w-0 flex-1 text-white">
          <p className="truncate text-[16px] font-bold">{item.title ?? groupLabel(item.groupName)}</p>
          <p className="truncate text-[13px] text-white/60">
            {item.title ? `${groupLabel(item.groupName)} · ` : ""}
            {formatUzDate(item.addedAt)}
          </p>
        </div>
        <LikeButton item={item} onToggle={() => onLike(item.id)} light />
      </div>
    </div>,
    host,
  );
}
