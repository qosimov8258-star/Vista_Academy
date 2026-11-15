"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp, School, X } from "lucide-react";
import { useTr } from "@/i18n/tr";

/**
 * Maqola izohlari — Instagramdagidek: avatar, qalin ism va matn bir qatorda,
 * ostida vaqt va «Javob berish». Javoblar bir daraja ichkarida, ko'p bo'lsa
 * yig'ilib turadi. Bog'cha (xodim) izohi ko'k belgi va «Bog'cha» yorlig'i bilan.
 *
 * Ota-ona kabinetida ham, xodimlar panelida ham ishlatiladi: ranglar kabinet
 * o'zgaruvchilaridan (`--p-*`) olinadi, panelda ular yo'q — o'rniga iOS
 * tizim ranglari (zaxira qiymat) ishlaydi.
 */

export type ArticleReactionKind = "LIKE" | "DISLIKE";

export interface ArticleCommentItem {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  author: { name: string | null; isStaff: boolean };
  mine: boolean;
  canDelete: boolean;
  replies?: ArticleCommentItem[];
}

const INK = "var(--p-ink,#1c1c1e)";
const MUTED = "var(--p-muted,#8e8e93)";
const BLUE = "#007aff";
const AVATAR_COLORS = ["#ff9500", "#34c759", "#af52de", "#ff2d55", "#30b0c7", "#5856d6", "#00c7be"];

/** Javoblar shundan ko'p bo'lsa — yig'ib qo'yiladi */
const COLLAPSE_AFTER = 2;

function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((word) => word.match(/\p{L}/u)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return letters.toUpperCase() || "?";
}

function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** «hozir», «5 daq», «3 soat», «2 kun», keyin sana */
export function useTimeAgo() {
  const tr = useTr();
  return (iso: string) => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
    if (minutes < 1) return tr("hozir");
    if (minutes < 60) return tr("{0} daq", minutes);
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return tr("{0} soat", hours);
    const days = Math.floor(hours / 24);
    if (days < 7) return tr("{0} kun", days);
    const date = new Date(iso);
    return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
  };
}

export function authorName(item: ArticleCommentItem, tr: (key: string) => string) {
  return item.author.isStaff ? item.author.name || tr("Bog'cha") : item.author.name || tr("Ota-ona");
}

function Avatar({ item, size }: { item: ArticleCommentItem; size: number }) {
  const tr = useTr();
  if (item.author.isStaff) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full text-white" style={{ width: size, height: size, background: BLUE }}>
        <School style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
      </span>
    );
  }
  const name = authorName(item, tr);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function CommentRow({
  item,
  small,
  onReply,
  onDelete,
}: {
  item: ArticleCommentItem;
  small?: boolean;
  onReply?: (item: ArticleCommentItem) => void;
  onDelete?: (item: ArticleCommentItem) => void;
}) {
  const tr = useTr();
  const timeAgo = useTimeAgo();
  return (
    <div className="flex items-start gap-3">
      <Avatar item={item} size={small ? 28 : 36} />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-line break-words text-[14.5px] leading-snug" style={{ color: INK }}>
          <span className="font-semibold">{authorName(item, tr)}</span>
          {item.author.isStaff && (
            <span className="ml-1.5 inline-flex translate-y-[-1px] items-center rounded-full bg-[#007aff]/12 px-1.5 py-[1px] align-middle text-[11px] font-semibold text-[#007aff]">
              {tr("Bog'cha")}
            </span>
          )}{" "}
          {item.body}
        </p>
        <div className="mt-1 flex items-center gap-4 text-[12.5px] font-medium" style={{ color: MUTED }}>
          <time dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
          {onReply && (
            <button type="button" onClick={() => onReply(item)} className="-my-2 py-2 font-semibold active:opacity-60">
              {tr("Javob berish")}
            </button>
          )}
          {item.canDelete && onDelete && (
            <button type="button" onClick={() => onDelete(item)} className="-my-2 py-2 font-semibold active:opacity-60">
              {tr("O'chirish")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Izohlar ro'yxati. `openThreads` — javob yozilgan iplar ochiq tursin;
 * `renderAfter` — izoh ostiga qo'shimcha blok (masalan, o'chirishni tasdiqlash
 * aynan bosilgan izohning o'zi ostida chiqsin).
 */
export function CommentThread({
  items,
  onReply,
  onDelete,
  openThreads = [],
  renderAfter,
}: {
  items: ArticleCommentItem[];
  onReply?: (item: ArticleCommentItem) => void;
  onDelete?: (item: ArticleCommentItem) => void;
  openThreads?: string[];
  renderAfter?: (item: ArticleCommentItem) => React.ReactNode;
}) {
  const tr = useTr();
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <ul className="space-y-5">
      {items.map((item) => {
        const replies = item.replies ?? [];
        const open = replies.length <= COLLAPSE_AFTER || expanded.includes(item.id) || openThreads.includes(item.id);
        return (
          <li key={item.id}>
            <CommentRow item={item} onReply={onReply} onDelete={onDelete} />
            {renderAfter?.(item)}
            {replies.length > 0 && (
              <div className="ml-12 mt-3">
                {open ? (
                  <ul className="space-y-3.5">
                    {replies.map((reply) => (
                      <li key={reply.id}>
                        <CommentRow item={reply} small onReply={onReply} onDelete={onDelete} />
                        {renderAfter?.(reply)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {replies.length > COLLAPSE_AFTER && !openThreads.includes(item.id) && (
                  <button
                    type="button"
                    onClick={() => setExpanded((list) => (list.includes(item.id) ? list.filter((id) => id !== item.id) : [...list, item.id]))}
                    className={clsx("flex items-center gap-3 py-1 text-[12.5px] font-semibold active:opacity-60", open && "mt-3")}
                    style={{ color: MUTED }}
                  >
                    <span className="h-px w-6" style={{ background: MUTED }} aria-hidden="true" />
                    {open ? tr("Javoblarni yashirish") : tr("Yana {0} ta javobni ko'rish", replies.length)}
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Izoh yozish maydoni: o'sib boradigan matn maydoni va dumaloq «yuborish»
 * tugmasi. Javob berilayotganda tepasida «… ga javob · ✕».
 */
export function CommentComposer({
  replyTo,
  onCancelReply,
  onSubmit,
  pending,
  error,
  hint,
  focusKey,
}: {
  replyTo: ArticleCommentItem | null;
  onCancelReply: () => void;
  /** true qaytarsa — maydon tozalanadi */
  onSubmit: (body: string) => Promise<boolean>;
  pending: boolean;
  error?: string | null;
  hint?: string;
  /** O'zgarsa — maydonga fokus beriladi (javob bosilganda) */
  focusKey?: string | number | null;
}) {
  const tr = useTr();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const ready = text.trim().length > 0 && !pending;

  useEffect(() => {
    if (focusKey == null) return;
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusKey]);

  // Matnga qarab balandlik (4 qatorgacha)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [text]);

  const submit = async () => {
    if (!ready) return;
    if (await onSubmit(text.trim())) setText("");
  };

  return (
    <div>
      {replyTo && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-[13px]" style={{ background: "var(--p-sunken,#f2f2f7)", color: MUTED }}>
          <span className="min-w-0 truncate">
            {tr("Javob:")} <span className="font-semibold" style={{ color: INK }}>{authorName(replyTo, tr)}</span>
          </span>
          <button type="button" onClick={onCancelReply} aria-label={tr("Javobni bekor qilish")} className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center active:opacity-60">
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 rounded-[22px] py-1.5 pl-4 pr-1.5" style={{ background: "var(--p-sunken,#f2f2f7)" }}>
        <textarea
          ref={ref}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Kompyuterda Enter — yuborish, Shift+Enter — yangi qator
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
              event.preventDefault();
              void submit();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder={replyTo ? tr("Javob yozing…") : tr("Izoh qo'shing…")}
          aria-label={replyTo ? tr("Javob yozing…") : tr("Izoh qo'shing…")}
          className="min-h-[36px] flex-1 resize-none bg-transparent py-[7px] text-[16px] leading-[22px] outline-none placeholder:text-[var(--p-muted,#8e8e93)]"
          style={{ color: INK }}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready}
          aria-label={tr("Yuborish")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-35"
          style={{ background: BLUE }}
        >
          <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />
        </button>
      </div>
      {error ? (
        <p className="mt-2 px-1 text-[13px] text-[#ff3b30]">{error}</p>
      ) : hint ? (
        <p className="mt-2 px-1 text-[12.5px] leading-snug" style={{ color: MUTED }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
