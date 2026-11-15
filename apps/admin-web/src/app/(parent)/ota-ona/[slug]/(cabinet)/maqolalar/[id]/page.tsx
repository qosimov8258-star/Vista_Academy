"use client";

import { use, useState } from "react";
import clsx from "clsx";
import { Bookmark, Check, Clock, Share2 } from "lucide-react";
import parentStyles from "../../../parent.module.css";
import { articleCoverUrl, categoryLabel, useParentArticle } from "../../foydali-content";
import { FoydaliHeader, ListSkeleton, LoadErrorCard, NotFoundCard } from "../../foydali/ui";
import { ArticleFeedbackSection } from "./article-feedback";
import { ApiError } from "@/lib/api";
import { useTr } from "@/i18n/tr";

/**
 * Bitta maqola: muqova, matn, «Hozir nima qilish mumkin» ro'yxati va
 * pastda «Eslatma» — uni oila a'zolariga ulashish mumkin (bitta yondashuv
 * butun oilada ishlasin). Ostida — anonim baho va izohlar.
 */
export default function ArticlePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const tr = useTr();
  const { slug, id } = use(params);
  const listHref = `/ota-ona/${slug}/maqolalar`;
  const query = useParentArticle(id);
  const [shared, setShared] = useState(false);
  const article = query.data;

  if (query.isError && !article) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <div className="mx-auto w-full max-w-[520px] px-4">
          <NotFoundCard backHref={listHref} backLabel="Maqolalar" text="Bu maqola topilmadi yoki olib tashlangan." />
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
        <LoadErrorCard error={query.error} onRetry={() => query.refetch()} loginHref={`/ota-ona/${slug}/kirish`} />
      </div>
    );
  }

  const share = async () => {
    if (!article) return;
    const text = [article.title, article.memo ?? article.summary, window.location.href].join("\n\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: article.title, text: article.memo ?? article.summary, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        window.setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // Ota-ona ulashishni bekor qildi — hech narsa qilinmaydi
    }
  };

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader backHref={listHref} backLabel="Maqolalar" title="" />

      {!article ? (
        <ListSkeleton rows={2} tall />
      ) : (
        <article className="mt-1 overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
          {article.hasCover && (
            <img src={articleCoverUrl(article)} alt="" className="aspect-[16/9] w-full bg-[var(--p-sunken)] object-cover" />
          )}
          <div className="p-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--p-sky)]/14 px-2.5 py-1 text-[12px] font-bold text-[var(--p-sky-ink)]">
              {tr(categoryLabel(article.category))}
              <span aria-hidden="true">·</span>
              <Clock className="h-3 w-3" strokeWidth={2.4} />
              {tr("{0} daqiqa", article.readMinutes)}
            </span>
            <h1 className={clsx(parentStyles.roundedFont, "mt-3 text-[25px] font-extrabold leading-tight tracking-[-0.01em] text-[var(--p-ink)]")}>
              {article.title}
            </h1>
            <p className="mt-2 text-[13px] text-[var(--p-muted)]">
              {article.addedBy}
              {article.groupName ? ` · ${article.groupName}` : ""}
            </p>

            <div className="mt-4 space-y-3.5">
              {article.paragraphs.map((paragraph, i) => (
                <p key={i} className="text-[16px] leading-[1.65] text-[var(--p-ink)]">
                  {paragraph}
                </p>
              ))}
            </div>

            {article.tips.length > 0 && (
              <section className="mt-6">
                <h2 className={clsx(parentStyles.roundedFont, "text-[18px] font-extrabold text-[var(--p-ink)]")}>
                  {tr("Hozir nima qilish mumkin")}
                </h2>
                <ul className="mt-3 space-y-3">
                  {article.tips.map((tip, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-[3px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--p-mint)]/16 text-[12.5px] font-extrabold text-[var(--p-mint)]">
                        {i + 1}
                      </span>
                      <p className="text-[15.5px] leading-relaxed text-[var(--p-ink)]">
                        <strong className="font-bold">{tip.title}.</strong> {tip.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {article.memo && (
              <div className="mt-6 flex items-start gap-3 rounded-[20px] bg-[var(--p-sun)]/14 px-4 py-3.5">
                <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-[var(--p-sun-ink)]" strokeWidth={2} />
                <p className="text-[14.5px] leading-relaxed text-[var(--p-ink)]">
                  <strong className="font-bold">{tr("Eslatma")}:</strong> {article.memo}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={share}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--p-sunken)] text-[15px] font-bold text-[var(--p-ink)] active:scale-[0.98]"
            >
              {shared ? <Check className="h-[18px] w-[18px]" strokeWidth={2.4} /> : <Share2 className="h-[18px] w-[18px]" strokeWidth={2.2} />}
              {shared ? tr("Nusxa olindi") : tr("Oila a'zolariga ulashish")}
            </button>
          </div>
        </article>
      )}

      {article && <ArticleFeedbackSection article={article} />}
    </div>
  );
}
