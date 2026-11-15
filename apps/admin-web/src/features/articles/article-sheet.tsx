"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Article, ArticleCategory, ArticleTip, Group, UsefulStatus } from "@/lib/types";
import { useAuthedImage } from "@/components/ui/child-photo";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FormSection } from "@/components/ios/form";
import { Pill } from "@/components/ios/pill";
import { CheckIcon } from "@/components/ios/icons";
import { ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IOS_TINT, IosIcon } from "@/features/director/ios-icon";
import { splitIntoBlocks } from "@/features/useful/split-blocks";
import { PhotoPicker } from "@/features/useful/photo-picker";
import { FIELD, FormError, GroupPickerRow, PublishRow, ReadingCard, TextBlock, publishFooter } from "@/features/useful/useful-parts";
import { useTr } from "@/i18n/tr";
import { ARTICLE_CATEGORIES, ARTICLE_CATEGORY_ORDER } from "./categories";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const MAX_TIPS = 8;

/** Muqova manzili; vaqt tamg'asi — almashtirilgach brauzer eskisini keshdan ko'rsatmasin */
export function articleCoverUrl(article: Pick<Article, "id" | "hasCover" | "updatedAt">): string | null {
  if (!article.hasCover) return null;
  return `${API_URL}/app/articles/${article.id}/cover?v=${encodeURIComponent(article.updatedAt)}`;
}

/** Ro'yxat qatoridagi 40px belgi: muqova bo'lsa — surat, aks holda mavzu plitkasi */
export function ArticleThumb({ article }: { article: Article }) {
  const { src, failed } = useAuthedImage(articleCoverUrl(article));
  const cat = ARTICLE_CATEGORIES[article.category];
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- blob manzil
      <img src={src} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-[12px] object-cover" />
    );
  }
  return <IosIcon icon={cat.icon} tint={cat.tint} size={40} />;
}

/** Maqola — ota-onalar ko'radigan ko'rinishda: muqova, mavzu, matn, maslahatlar, eslatma */
export function ArticleReading({
  title,
  category,
  readMinutes,
  coverSrc,
  summary,
  paragraphs,
  tips,
  memo,
}: {
  title: string;
  category: ArticleCategory;
  readMinutes: number | null;
  coverSrc: string | null;
  summary: string;
  paragraphs: string[];
  tips: ArticleTip[];
  memo: string | null;
}) {
  const tr = useTr();
  const cat = ARTICLE_CATEGORIES[category];
  const color = IOS_TINT[cat.tint];
  return (
    <ReadingCard>
      {coverSrc && (
        <div className="-mx-5 -mt-5 overflow-hidden rounded-t-[18px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob manzil */}
          <img src={coverSrc} alt="" className="block aspect-[16/9] w-full object-cover" />
        </div>
      )}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill color={color}>{tr(cat.label)}</Pill>
          {readMinutes ? <span className="text-[13px] text-[#8e8e93]">{tr("{0} daqiqa o'qish", readMinutes)}</span> : null}
        </div>
        <p className="text-[20px] font-bold leading-tight text-[var(--color-text)]">{title ? tr(title) : tr("Sarlavha")}</p>
        {summary && <p className="text-[15.5px] leading-snug text-[#8e8e93]">{tr(summary)}</p>}
      </div>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-[16.5px] leading-[1.65] text-[var(--color-text)]">
          {tr(p)}
        </p>
      ))}
      {tips.length > 0 && (
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#8e8e93]">{tr("Hozir nima qilish mumkin")}</p>
          <ul className="mt-2 space-y-2.5">
            {tips.map((tip, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                <span className="min-w-0 text-[15.5px] leading-snug text-[var(--color-text)]">
                  <span className="font-semibold">{tr(tip.title)}</span>
                  {tip.text ? <span className="block text-[var(--color-text)]/80">{tr(tip.text)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {memo?.trim() && (
        <div className="rounded-[14px] px-4 py-3" style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
          <p className="text-[12.5px] font-semibold uppercase tracking-wide" style={{ color }}>
            {tr("Eslatma")}
          </p>
          <p className="mt-1 text-[15.5px] leading-relaxed text-[var(--color-text)]">{tr(memo)}</p>
        </div>
      )}
    </ReadingCard>
  );
}

/** Mavzu tanlagichi — 7 ta variant, plitkali radio to'ri (native select yo'q) */
function CategoryGrid({ value, onChange, error }: { value: ArticleCategory | null; onChange: (c: ArticleCategory) => void; error?: string }) {
  const tr = useTr();
  return (
    <div className={clsx("p-3", error && "bg-[#ff3b30]/[0.06]")}>
      <div role="radiogroup" aria-label={tr("Mavzu")} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ARTICLE_CATEGORY_ORDER.map((key) => {
          const cat = ARTICLE_CATEGORIES[key];
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(key)}
              className={clsx(
                "flex min-h-[52px] items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left transition-transform active:scale-[0.97]",
                active ? "bg-white ring-[2.5px] ring-[var(--color-primary)]" : "bg-[#767680]/[0.08]",
              )}
            >
              <IosIcon icon={cat.icon} tint={cat.tint} size={30} />
              <span className="min-w-0 flex-1 text-[14px] font-medium leading-tight text-[var(--color-text)]">{tr(cat.label)}</span>
              {active && <CheckIcon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" strokeWidth={2.8} />}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="px-1 pt-2 text-[12.5px] leading-snug text-[#ff3b30]">
          {tr(error)}
        </p>
      )}
    </div>
  );
}

type CoverState = { kind: "keep" } | { kind: "new"; image: string } | { kind: "removed" };

/** Yangi maqola / tahrirlash — iOS varag'i */
export function ArticleSheet({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  article,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  isTeacher: boolean;
  article: Article | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const isEdit = !!article;

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ArticleCategory | null>(null);
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [tips, setTips] = useState<ArticleTip[]>([]);
  const [memo, setMemo] = useState("");
  const [groupId, setGroupId] = useState("");
  const [status, setStatus] = useState<UsefulStatus>("PUBLISHED");
  const [cover, setCover] = useState<CoverState>({ kind: "keep" });
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(article?.title ?? "");
    setCategory(article?.category ?? null);
    setSummary(article?.summary ?? "");
    setBody(article?.body ?? "");
    setTips(article?.tips ?? []);
    setMemo(article?.memo ?? "");
    setGroupId(article?.groupId ?? "");
    setStatus(article?.status ?? "PUBLISHED");
    setCover({ kind: "keep" });
    setTried(false);
  }, [open, article]);

  // Tarbiyachining bitta guruhi bo'lsa — o'zi tanlanadi
  const onlyGroupId = isTeacher && groups.length === 1 ? groups[0].id : "";
  useEffect(() => {
    if (open && onlyGroupId) setGroupId((current) => current || onlyGroupId);
  }, [open, onlyGroupId]);

  // Mavjud muqova — faqat tahrirlashda va almashtirilmagan bo'lsa
  const existing = useAuthedImage(open && article && cover.kind === "keep" ? articleCoverUrl(article) : null);
  const coverSrc = cover.kind === "new" ? cover.image : cover.kind === "keep" && !existing.failed ? existing.src : null;
  const coverLoading = cover.kind === "keep" && !!article?.hasCover && !existing.src && !existing.failed;

  const cleanTips = tips.map((t) => ({ title: t.title.trim(), text: t.text.trim() })).filter((t) => t.title || t.text);
  const badTip = cleanTips.some((t) => t.title.length < 2 || t.title.length > 80 || t.text.length < 2 || t.text.length > 400);

  const errors = {
    title: title.trim().length < 3 ? "Sarlavha kamida 3 belgi bo'lsin" : undefined,
    category: !category ? "Mavzuni tanlang" : undefined,
    summary: summary.trim().length < 3 ? "Qisqa izoh kamida 3 belgi bo'lsin" : undefined,
    body: body.trim().length < 10 ? "Matn kamida 10 belgi bo'lsin" : undefined,
    tips: badTip ? "Har bir maslahatda sarlavha (2–80 belgi) va matn (2–400 belgi) bo'lsin" : undefined,
    group: isTeacher && !groupId ? "Guruhni tanlang" : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (key: keyof typeof errors) => (tried ? errors[key] : undefined);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        category,
        title: title.trim(),
        summary: summary.trim(),
        body,
        tips: cleanTips,
        memo: memo.trim() || null,
        groupId: groupId || null,
        status,
      };
      if (cover.kind === "new") payload.cover = cover.image;
      else if (cover.kind === "removed" && article?.hasCover) payload.cover = null;
      return isEdit ? api.patch<Article>(`/app/articles/${article!.id}`, payload) : api.post<Article>("/app/articles", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles", slug] });
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

  const setTip = (index: number, patch: Partial<ArticleTip>) => setTips((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));

  return (
    <IosSheet
      open={open}
      onClose={() => !save.isPending && onClose()}
      title={tr(isEdit ? "Maqolani tahrirlash" : "Yangi maqola")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={save.isPending} dim={!valid}>
          {tr(isEdit ? "Saqlash" : "Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <FormSection title={tr("Muqova · ixtiyoriy")}>
        <PhotoPicker
          src={coverSrc}
          loading={coverLoading}
          onPicked={(image) => setCover({ kind: "new", image })}
          onRemove={() => setCover({ kind: "removed" })}
          aspect="wide"
          emptyTitle="Muqova surati"
          emptyHint="Mavzuga mos surat — ro'yxatda va maqola tepasida ko'rinadi"
          alt={tr("Muqova")}
        />
      </FormSection>

      <FormSection title={tr("Sarlavha")}>
        <TextBlock
          value={title}
          onChange={(v) => setTitle(v.replace(/\n/g, " "))}
          placeholder="Bolaga qo'rquvni yengishda qanday yordam berish mumkin?"
          maxLength={140}
          minRows={1}
          error={show("title")}
          ariaLabel="Sarlavha"
        />
      </FormSection>

      <FormSection title={tr("Mavzu")}>
        <CategoryGrid value={category} onChange={setCategory} error={show("category")} />
      </FormSection>

      <FormSection title={tr("Qisqa izoh")} footer={tr("Ro'yxatda sarlavha ostida chiqadi — bir-ikki gap.")}>
        <TextBlock
          value={summary}
          onChange={setSummary}
          placeholder="Qo'rquv — bola rivojlanishining tabiiy qismi. Uni qanday qo'llab-quvvatlash kerak?"
          maxLength={300}
          minRows={2}
          error={show("summary")}
          ariaLabel="Qisqa izoh"
        />
      </FormSection>

      <FormSection title={tr("Matn")} footer={tr("Xatboshilar orasida bitta bo'sh qator qoldiring.")}>
        <TextBlock
          value={body}
          onChange={setBody}
          placeholder={"Birinchi xatboshi...\n\nKeyingi xatboshi..."}
          maxLength={12000}
          minRows={8}
          error={show("body")}
          ariaLabel="Matn"
        />
      </FormSection>

      <FormSection
        title={tr("Maslahatlar · ixtiyoriy")}
        footer={
          show("tips") ? (
            <span className="text-[#ff3b30]">{tr(errors.tips!)}</span>
          ) : (
            tr("«Hozir nima qilish mumkin» ro'yxati. Ko'pi bilan {0} ta.", MAX_TIPS)
          )
        }
      >
        {tips.map((tip, i) => (
          <div key={i} className="group/row relative flex items-start gap-2 py-2 pl-4 pr-2">
            <span className="mt-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[12.5px] font-semibold tabular-nums text-[#8e8e93]">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <input
                value={tip.title}
                onChange={(e) => setTip(i, { title: e.target.value })}
                maxLength={80}
                placeholder={tr("Maslahat sarlavhasi")}
                aria-label={tr("{0}-maslahat sarlavhasi", i + 1)}
                className={clsx(FIELD, "py-2.5 font-semibold")}
              />
              <TipText value={tip.text} onChange={(text) => setTip(i, { text })} label={tr("{0}-maslahat matni", i + 1)} />
            </div>
            <button
              type="button"
              onClick={() => setTips((prev) => prev.filter((_, j) => j !== i))}
              aria-label={tr("Maslahatni olib tashlash")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#8e8e93] transition-colors active:bg-[#767680]/[0.12] active:text-[#ff3b30]"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
            <span className={ROW_SEPARATOR} aria-hidden="true" />
          </div>
        ))}
        {tips.length < MAX_TIPS && (
          <div className="group/row relative">
            <button
              type="button"
              onClick={() => setTips((prev) => [...prev, { title: "", text: "" }])}
              className={clsx("flex min-h-[50px] w-full items-center gap-2 px-4 text-left text-[16px] font-medium text-[var(--color-primary)]", ROW_PRESS)}
            >
              <Plus className="h-5 w-5" strokeWidth={2.4} />
              {tr("Maslahat qo'shish")}
            </button>
            <span className={ROW_SEPARATOR} aria-hidden="true" />
          </div>
        )}
      </FormSection>

      <FormSection title={tr("Eslatma · ixtiyoriy")} footer={tr("Maqola oxirida rangli blokda chiqadi.")}>
        <TextBlock value={memo} onChange={setMemo} placeholder="Har bir bola o'z sur'atida rivojlanadi." maxLength={400} minRows={2} ariaLabel="Eslatma" />
      </FormSection>

      <FormSection title={tr("Kimga")} footer={tr(publishFooter(status))}>
        <GroupPickerRow groups={groups} value={groupId} onChange={setGroupId} allowWholeBranch={!isTeacher} error={show("group")} />
        <PublishRow status={status} onChange={setStatus} />
      </FormSection>

      <FormError message={save.error ? (save.error instanceof ApiError ? save.error.message : "Kutilmagan xatolik yuz berdi") : null} />
    </IosSheet>
  );
}

/** Maslahat matni — yozgan sari o'sadigan kichik textarea */
function TipText({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const tr = useTr();
  return (
    <textarea
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      ref={(el) => {
        if (el) {
          el.style.height = "auto";
          el.style.height = `${el.scrollHeight}px`;
        }
      }}
      maxLength={400}
      rows={2}
      placeholder={tr("Nima qilish kerak — qisqa tushuntiring")}
      aria-label={label}
      className={clsx(FIELD, "block resize-none pb-2.5 text-[15px] leading-snug")}
    />
  );
}

/** Ko'rish varag'i uchun: matn → xatboshilar (serverdagi qoida bilan bir xil) */
export function articleParagraphs(body: string): string[] {
  return splitIntoBlocks(body).map((b) => b.join(" "));
}
