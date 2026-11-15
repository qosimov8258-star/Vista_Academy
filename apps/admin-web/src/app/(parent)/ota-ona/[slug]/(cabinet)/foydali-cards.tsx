"use client";

import Link from "next/link";
import clsx from "clsx";
import { BookOpen, ChevronRight, Gamepad2, Images } from "lucide-react";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";
import { articleCoverUrl, galleryImageUrl, useParentArticles, useParentGallery } from "./foydali-content";
import { useTr } from "@/i18n/tr";

/** O'yinlar vidjetidagi rasmlar — o'yinlarning o'zidan */
const GAME_PICS = ["/_oyinlar/hayvonlar/lion.png", "/_oyinlar/hayvonlar/rooster.png", "/_oyinlar/mevalar/strawberry.png"];

const CARD = "rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]";

/**
 * Bosh sahifadagi «Foydali» bloki — iOS vidjetlari ko'rinishida: tepada
 * maqolalar (keng karta, muqova bilan), ostida ikki kichik vidjet —
 * o'yinlar va galereya. Har biri o'z funksiyasi yoqilgan bo'lsagina chiqadi;
 * mazmuni yo'q bo'lsa ham karta turadi (bo'limning borligini ota-ona bilsin).
 */
export function FoydaliCards({
  slug,
  articlesOn,
  galleryOn,
}: {
  slug: string;
  articlesOn: boolean;
  galleryOn: boolean;
}) {
  const tr = useTr();
  const base = `/ota-ona/${slug}`;
  const articles = useParentArticles(articlesOn);
  const gallery = useParentGallery(galleryOn);
  const latest = articles.data?.[0];
  const photos = (gallery.data ?? []).slice(0, 2);

  return (
    <section className="mt-8">
      <div className="mb-2.5 px-1">
        <h2 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">{tr("Foydali")}</h2>
      </div>

      <div className="space-y-3">
        {/* Maqolalar — keng karta */}
        {articlesOn && (
          <Link href={`${base}/maqolalar`} className={`${CARD} block p-2 transition-transform active:scale-[0.99]`}>
            {latest?.hasCover && (
              <img
                src={articleCoverUrl(latest)}
                alt=""
                loading="lazy"
                className="aspect-[2/1] w-full rounded-[18px] bg-[var(--p-sunken)] object-cover"
              />
            )}
            <div className="flex items-center gap-3 px-2 py-2.5">
              <IosIcon icon={BookOpen} tint="indigo" size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold leading-snug text-[var(--p-ink)]">{tr("Ota-onalarga eslatma")}</p>
                <p className="truncate text-[13.5px] text-[var(--p-muted)]">
                  {latest ? latest.title : tr("Pedagog maslahatlari va uyda mashg'ulot g'oyalari")}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--p-chevron)]" strokeWidth={2.4} aria-hidden="true" />
            </div>
          </Link>
        )}

        {/* O'yinlar va galereya — ikki vidjet yonma-yon; biri yo'q bo'lsa qolgani butun qatorni oladi */}
        <div className={clsx("grid gap-3", galleryOn ? "grid-cols-2" : "grid-cols-1")}>
          <MiniWidget
            href={`${base}/oyinlar`}
            icon={Gamepad2}
            tint="green"
            title={tr("O'yinlar")}
            text={tr("Xotira va diqqat")}
            media={
              <span className="flex h-full items-end justify-center gap-1 pb-1.5">
                {GAME_PICS.map((src, i) => (
                  <img key={src} src={src} alt="" className={clsx("object-contain", i === 1 ? "h-[54px] w-[54px]" : "h-[40px] w-[40px]")} />
                ))}
              </span>
            }
            mediaBg="rgba(52,199,89,0.1)"
          />
          {galleryOn && (
            <MiniWidget
              href={`${base}/galereya`}
              icon={Images}
              tint="pink"
              title={tr("Galereya")}
              text={tr("Bolalar ishlari")}
              media={
                photos.length > 0 ? (
                  <span className="grid h-full w-full gap-0.5" style={{ gridTemplateColumns: `repeat(${photos.length}, 1fr)` }}>
                    {photos.map((item) => (
                      <img key={item.id} src={galleryImageUrl(item.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ))}
                  </span>
                ) : (
                  <span className="flex h-full items-center justify-center">
                    <Images className="h-9 w-9 text-[var(--p-red)] opacity-60" strokeWidth={1.7} />
                  </span>
                )
              }
              mediaBg="rgba(255,45,85,0.08)"
            />
          )}
        </div>
      </div>
    </section>
  );
}

/** Kichik vidjet: tepada plitka va «›», nom, izoh, pastda rasm tasmasi */
function MiniWidget({
  href,
  icon,
  tint,
  title,
  text,
  media,
  mediaBg,
}: {
  href: string;
  icon: AnyIcon;
  tint: IosTint;
  title: string;
  text: string;
  media: React.ReactNode;
  mediaBg: string;
}) {
  return (
    <Link href={href} className={`${CARD} flex min-w-0 flex-col p-3.5 transition-transform active:scale-[0.98]`}>
      <span className="flex items-center justify-between">
        <IosIcon icon={icon} tint={tint} size={32} />
        <ChevronRight className="h-5 w-5 text-[var(--p-chevron)]" strokeWidth={2.4} aria-hidden="true" />
      </span>
      <span className="mt-2.5 block truncate text-[16px] font-semibold text-[var(--p-ink)]">{title}</span>
      <span className="block truncate text-[13px] text-[var(--p-muted)]">{text}</span>
      <span className="mt-3 block h-[72px] overflow-hidden rounded-[14px]" style={{ background: mediaBg }}>
        {media}
      </span>
    </Link>
  );
}
