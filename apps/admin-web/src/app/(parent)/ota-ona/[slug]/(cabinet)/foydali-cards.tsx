"use client";

import Link from "next/link";
import clsx from "clsx";
import { BookOpen, Gamepad2, Images } from "lucide-react";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";
import { articleCoverUrl, galleryImageUrl, useParentArticles, useParentGallery } from "./foydali-content";
import { useTr } from "@/i18n/tr";

/** O'yinlar kartasidagi rasmlar — o'yinlarning o'zidan */
const GAME_PICS = ["/_oyinlar/foto/yovvoyi/lion.webp", "/_oyinlar/foto/hayvonlar/rooster.webp", "/_oyinlar/foto/mevalar/cherries.webp"];

/**
 * Bosh sahifadagi «Foydali» — yonga suriladigan kartalar (barmoq bilan,
 * har karta o'z joyiga «yopishadi»). Keyingi karta chetdan ko'rinib turadi —
 * surish mumkinligi shundan bilinadi. Sahifaning o'zi yonga surilmaydi:
 * surilish faqat shu tasma ichida.
 * Har karta o'z funksiyasi yoqilgan bo'lsagina chiqadi.
 */
export function FoydaliCards({ slug, articlesOn, galleryOn }: { slug: string; articlesOn: boolean; galleryOn: boolean }) {
  const tr = useTr();
  const base = `/ota-ona/${slug}`;
  const articles = useParentArticles(articlesOn);
  const gallery = useParentGallery(galleryOn);
  const latest = articles.data?.[0];
  const photos = (gallery.data ?? []).slice(0, 2);

  return (
    <section className="mt-8">
      <h2 className="px-1 text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">{tr("Foydali")}</h2>

      <div className="-mx-4 mt-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-5 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {articlesOn && (
          <Slide
            href={`${base}/maqolalar`}
            icon={BookOpen}
            tint="indigo"
            title={tr("Ota-onalarga eslatma")}
            text={latest ? latest.title : tr("Pedagog maslahatlari va uyda mashg'ulot g'oyalari")}
            mediaBg="color-mix(in srgb, #5856d6 12%, transparent)"
            media={
              latest?.hasCover ? (
                <img src={articleCoverUrl(latest)} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <BookOpen className="h-11 w-11 text-[#5856d6] opacity-60" strokeWidth={1.7} />
              )
            }
          />
        )}
        <Slide
          href={`${base}/oyinlar`}
          icon={Gamepad2}
          tint="green"
          title={tr("Rivojlantiruvchi o'yinlar")}
          text={tr("Xotira va diqqat")}
          mediaBg="color-mix(in srgb, #34c759 13%, transparent)"
          media={
            <span className="flex items-end gap-1.5">
              {GAME_PICS.map((src, i) => (
                <img key={src} src={src} alt="" className={clsx("object-contain", i === 1 ? "h-[76px] w-[76px]" : "h-[56px] w-[56px]")} />
              ))}
            </span>
          }
        />
        {galleryOn && (
          <Slide
            href={`${base}/galereya`}
            icon={Images}
            tint="pink"
            title={tr("Galereya")}
            text={tr("Bolalar ishlari")}
            mediaBg="color-mix(in srgb, #ff2d55 9%, transparent)"
            media={
              photos.length > 0 ? (
                <span className="grid h-full w-full gap-0.5" style={{ gridTemplateColumns: `repeat(${photos.length}, 1fr)` }}>
                  {photos.map((item) => (
                    <img key={item.id} src={galleryImageUrl(item.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ))}
                </span>
              ) : (
                <Images className="h-11 w-11 text-[#ff2d55] opacity-60" strokeWidth={1.7} />
              )
            }
          />
        )}
      </div>
    </section>
  );
}

/** Tasmadagi bitta karta: tepada rasm, ostida plitka belgi, nom va izoh */
function Slide({
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
    <Link
      href={href}
      className="w-[72%] max-w-[270px] shrink-0 snap-start rounded-[var(--p-radius)] bg-[var(--p-card)] p-2 shadow-[var(--p-shadow)] transition-transform active:scale-[0.98]"
    >
      <span className="flex h-[124px] items-center justify-center overflow-hidden rounded-[18px]" style={{ background: mediaBg }}>
        {media}
      </span>
      <span className="flex items-center gap-2.5 px-1.5 pb-1.5 pt-2.5">
        <IosIcon icon={icon} tint={tint} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-semibold leading-snug text-[var(--p-ink)]">{title}</span>
          <span className="block truncate text-[13px] text-[var(--p-muted)]">{text}</span>
        </span>
      </span>
    </Link>
  );
}
