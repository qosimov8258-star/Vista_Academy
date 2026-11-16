"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BookOpen, ChevronRight, Clock } from "lucide-react";
import parentStyles from "../../parent.module.css";
import { ARTICLE_CATEGORIES, ArticlesIcon, articleCoverUrl, categoryLabel, useParentArticles, type ArticleCategory } from "../foydali-content";
import { EmptyCard, FoydaliHeader, ListSkeleton, LoadErrorCard } from "../foydali/ui";
import { useTr } from "@/i18n/tr";

/**
 * «Ota-onalarga eslatma» — bog'cha yozgan maqolalar. Tepada mavzular
 * (faqat maqolasi borlari), pastda muqovali kartalar.
 */
export default function ArticlesPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const base = `/ota-ona/${slug}/maqolalar`;
  const query = useParentArticles();
  const [category, setCategory] = useState<ArticleCategory | null>(null);

  const articles = useMemo(() => query.data ?? [], [query.data]);
  const present = ARTICLE_CATEGORIES.filter((item) => articles.some((article) => article.category === item.id));
  const shown = category ? articles.filter((article) => article.category === category) : articles;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader
        title={tr("Ota-onalarga eslatma")}
        subtitle={tr("Pedagog va psixologlar maslahatlari, bola bilan uyda mashg'ulot g'oyalari")}
      />

      {query.isError && !query.data ? (
        <div className="mt-5">
          <LoadErrorCard error={query.error} onRetry={() => query.refetch()} loginHref={`/ota-ona/${slug}/kirish`} />
        </div>
      ) : query.isPending ? (
        <div className="mt-5">
          <ListSkeleton rows={3} tall />
        </div>
      ) : articles.length === 0 ? (
        <EmptyCard Icon={ArticlesIcon} tone="lilac" title="Hozircha maqola yo'q" text="Bog'cha maqola qo'shganda shu yerda chiqadi." />
      ) : (
        <>
          {/* Mavzular — gorizontal emas, o'raladi: telefonda surilish yo'q */}
          {present.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label={tr("Mavzular")}>
              <Chip active={!category} onClick={() => setCategory(null)}>
                {tr("Barcha mavzular")}
              </Chip>
              {present.map((item) => (
                <Chip key={item.id} active={category === item.id} onClick={() => setCategory(item.id)}>
                  {tr(item.label)}
                </Chip>
              ))}
            </div>
          )}

          <ul className="mt-5 space-y-4">
            {shown.map((article) => (
              <li key={article.id}>
                <Link
                  href={`${base}/${article.id}`}
                  className="block overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)] transition-transform active:scale-[0.99]"
                >
                  {article.hasCover ? (
                    <img
                      src={articleCoverUrl(article)}
                      alt=""
                      loading="lazy"
                      className="aspect-[16/9] w-full bg-[var(--p-sunken)] object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[16/7] w-full items-center justify-center bg-[var(--p-lilac)]/12">
                      <BookOpen className="h-10 w-10 text-[var(--p-lilac-ink)] opacity-70" strokeWidth={1.8} />
                    </div>
                  )}
                  <div className="p-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--p-sky)]/14 px-2.5 py-1 text-[12px] font-bold text-[var(--p-sky-ink)]">
                      {tr(categoryLabel(article.category))}
                      <span aria-hidden="true">·</span>
                      <Clock className="h-3 w-3" strokeWidth={2.4} />
                      {tr("{0} daqiqa", article.readMinutes)}
                    </span>
                    <p className={clsx(parentStyles.roundedFont, "mt-2.5 text-[20px] font-extrabold leading-snug text-[var(--p-ink)]")}>
                      {article.title}
                    </p>
                    <p className="mt-1.5 line-clamp-3 text-[14.5px] leading-relaxed text-[var(--p-muted)]">{article.summary}</p>
                    <span className="mt-3.5 inline-flex items-center gap-1 rounded-full bg-[var(--p-sunken)] px-3.5 py-2 text-[14px] font-bold text-[var(--p-ink)]">
                      {tr("Maqolani o'qish")}
                      <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={clsx(
        "min-h-[36px] rounded-full px-3.5 text-[13.5px] font-semibold transition-colors",
        active ? "bg-[var(--p-sky)] text-white" : "bg-[var(--p-card)] text-[var(--p-ink)] shadow-[var(--p-shadow)]",
      )}
    >
      {children}
    </button>
  );
}
