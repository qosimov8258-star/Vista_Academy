"use client";

import Link from "next/link";
import clsx from "clsx";
import { BookOpen, ChevronRight, Palette } from "lucide-react";
import styles from "../parent.module.css";
import { articleCoverUrl, galleryImageUrl, useParentArticles, useParentGallery } from "./foydali-content";
import { useTr } from "@/i18n/tr";

/** O'yinlar kartasidagi rasmlar — o'yinlarning o'zidan */
const GAME_PICS = ["/_oyinlar/hayvonlar/lion.png", "/_oyinlar/hayvonlar/rooster.png", "/_oyinlar/mevalar/strawberry.png"];

/**
 * Bosh sahifadagi «Foydali» bloki: maqolalar, o'yinlar va galereyaga
 * kirish. Har karta o'z funksiyasi yoqilgan bo'lsagina chiqadi; mazmuni
 * yo'q bo'lsa ham karta turadi (bo'limning borligini ota-ona bilsin).
 */
export function FoydaliCards({
  slug,
  orgName,
  articlesOn,
  galleryOn,
}: {
  slug: string;
  orgName: string | undefined;
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
    <section className="mt-9">
      <h2 className="px-1 text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">{tr("Foydali")}</h2>
      <p className="mt-1 px-1 text-[14px] leading-relaxed text-[var(--p-muted)]">
        {tr("Maqolalar, rivojlantiruvchi o'yinlar va bolalar ijodi — bir joyda")}
      </p>

      <div className="mt-4 space-y-4">
        {articlesOn && (
          <FoydaliCard
            href={`${base}/maqolalar`}
            chip={tr("Maqola va maslahatlar")}
            title={tr("Ota-onalarga eslatma")}
            text={latest ? latest.title : tr("Pedagog maslahatlari va uyda mashg'ulot g'oyalari")}
            action={tr("Bo'limga o'tish")}
            tone="sky"
            media={
              latest?.hasCover ? (
                <img src={articleCoverUrl(latest)} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <BookOpen className="h-12 w-12 text-[var(--p-sky-ink)] opacity-70" strokeWidth={1.7} />
              )
            }
          />
        )}

        <FoydaliCard
          href={`${base}/oyinlar`}
          chip={tr("Bepul · 2–7 yosh")}
          title={tr("Rivojlantiruvchi o'yinlar")}
          text={tr("Xotira, eshitish va diqqat uchun o'yinlar — reklamasiz")}
          action={tr("O'ynash")}
          tone="mint"
          media={
            <span className="flex items-end gap-1">
              {GAME_PICS.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={clsx(styles.float, "object-contain", i === 1 ? "h-[76px] w-[76px]" : "h-[56px] w-[56px]")}
                  style={{ animationDelay: `${i * 0.4}s` }}
                />
              ))}
            </span>
          }
        />

        {galleryOn && (
          <FoydaliCard
            href={`${base}/galereya`}
            chip={tr("Ijod muzeyi")}
            title={orgName ? tr("{0} galereyasi", orgName) : tr("Galereya")}
            text={tr("Bolalarimiz chizgan rasmlar, kardon va loy ishlari")}
            action={tr("Galereyani ko'rish")}
            tone="coral"
            media={
              photos.length > 0 ? (
                <span className="grid h-full w-full gap-1" style={{ gridTemplateColumns: `repeat(${photos.length}, 1fr)` }}>
                  {photos.map((item) => (
                    <img key={item.id} src={galleryImageUrl(item.id)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ))}
                </span>
              ) : (
                <Palette className="h-12 w-12 text-[var(--p-coral)] opacity-70" strokeWidth={1.7} />
              )
            }
          />
        )}
      </div>
    </section>
  );
}

const TONE_BG = {
  sky: "bg-[var(--p-sky)]/14",
  mint: "bg-[var(--p-mint)]/14",
  coral: "bg-[var(--p-coral)]/14",
} as const;
const TONE_CHIP = {
  sky: "bg-[var(--p-sky)]/14 text-[var(--p-sky-ink)]",
  mint: "bg-[var(--p-mint)]/14 text-[var(--p-mint)]",
  coral: "bg-[var(--p-coral)]/14 text-[var(--p-coral)]",
} as const;

function FoydaliCard({
  href,
  chip,
  title,
  text,
  action,
  tone,
  media,
}: {
  href: string;
  chip: string;
  title: string;
  text: string;
  action: string;
  tone: keyof typeof TONE_BG;
  media: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)] transition-transform active:scale-[0.99]"
    >
      {/* Rasm qismi kartaning ichida, o'z burchagi bilan — iOS «widget» hissi */}
      <div className="p-2 pb-0">
        <div className={clsx("flex h-[140px] items-center justify-center overflow-hidden rounded-[18px]", TONE_BG[tone])}>{media}</div>
      </div>
      <div className="px-4 pb-4 pt-3.5">
        <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold", TONE_CHIP[tone])}>{chip}</span>
        <p className="mt-2 text-[19px] font-bold leading-snug tracking-[-0.015em] text-[var(--p-ink)]">{title}</p>
        <p className="mt-1 line-clamp-2 text-[14.5px] leading-relaxed text-[var(--p-muted)]">{text}</p>
        <span className="mt-3 inline-flex min-h-[36px] items-center gap-0.5 text-[15px] font-semibold text-[var(--p-sky-ink)]">
          {action}
          <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
        </span>
      </div>
    </Link>
  );
}
