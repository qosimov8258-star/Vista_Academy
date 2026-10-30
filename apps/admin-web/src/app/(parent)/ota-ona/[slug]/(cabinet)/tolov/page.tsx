"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import type {
  ParentAccount,
  ParentChild,
  ParentPaymentReceipt,
  ParentPaymentSummary,
  PaymentCardInfo,
} from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { prepareReceiptPhoto } from "@/lib/receipt-photo";
import { CameraIcon, CheckIcon, ClockIcon, CopyIcon, WalletIcon } from "@/components/ui/icons";
import { CardVisual } from "@/features/payments/card-visual";
import styles from "../../parent.module.css";
import { ChildSwitcher } from "../child-switcher";
import { useSelectedChild } from "../use-selected-child";
import { EmptyCard, ListSkeleton, LoadErrorCard } from "../foydali/ui";
import { useTr } from "@/i18n/tr";

const STATUS_LABEL: Record<ParentPaymentReceipt["status"], string> = {
  PENDING: "Tekshirilmoqda",
  APPROVED: "Tasdiqlandi",
  REJECTED: "Rad etildi",
};

const STATUS_TONE: Record<ParentPaymentReceipt["status"], string> = {
  PENDING: "bg-[var(--p-sun)]/20 text-[var(--p-sun-ink)]",
  APPROVED: "bg-[var(--p-mint)]/15 text-[var(--p-mint)]",
  REJECTED: "bg-[var(--p-coral)]/15 text-[var(--p-coral)]",
};

const FIELD =
  "w-full rounded-[16px] bg-[var(--p-sunken)] px-4 py-3 text-[15px] text-[var(--p-ink)] outline-none ring-1 ring-[var(--p-muted)]/20 placeholder:text-[var(--p-muted)] focus:ring-2 focus:ring-[var(--p-sun)]";

/**
 * To'lov — ota-ona bog'cha kartasini ko'radi, shu kartaga pul o'tkazadi,
 * summani yozib chek suratini yuboradi. Chek moliyachiga tushadi; u
 * tasdiqlagach summa bolaning qarzidan ayriladi. Tasdiqlanmaguncha qarz
 * o'zgarmaydi — chek "Tekshirilmoqda" holatida turadi.
 */
export default function ParentPaymentPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const router = useRouter();

  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  useEffect(() => {
    if (meQuery.isError && meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      router.replace(`/ota-ona/${slug}/kirish`);
    }
  }, [meQuery.isError, meQuery.error, router, slug]);

  const { child, childId, multiple } = useSelectedChild(slug, meQuery.data?.children);

  const summaryQuery = useQuery({
    queryKey: ["parent-payment-summary", childId],
    queryFn: () => parentApi.get<ParentPaymentSummary>(`/app/parent/children/${childId}/payment-summary`),
    enabled: !!childId,
    retry: false,
  });
  const cardQuery = useQuery({
    queryKey: ["parent-payment-card", slug],
    queryFn: () => parentApi.get<PaymentCardInfo | null>("/app/parent/payment-card"),
    retry: false,
  });
  const receiptsQuery = useQuery({
    queryKey: ["parent-payment-receipts", childId],
    queryFn: () => parentApi.get<ParentPaymentReceipt[]>(`/app/parent/children/${childId}/payment-receipts`),
    enabled: !!childId,
    retry: false,
  });

  // Moliya bo'limiga kirish huquqi berilmagan ota-ona (backend 403 qaytaradi)
  const forbidden = summaryQuery.error instanceof ApiError && summaryQuery.error.status === 403;
  const summary = summaryQuery.data;
  const card = cardQuery.data;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      <header>
        <h1 className={`${styles.roundedFont} text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--p-ink)]`}>
          {tr("To'lov")}
        </h1>
        <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--p-muted)]">
          {tr("Kartaga o'tkazing, chekni yuboring — moliyachi tekshiradi")}
        </p>
      </header>

      {multiple && child && <ChildSwitcher slug={slug} child={child} />}

      {forbidden ? (
        <EmptyCard
          Icon={WalletIcon}
          tone="lilac"
          title="To'lov bo'limi yopiq"
          text="Sizga moliya bo'limiga kirish huquqi berilmagan. Bog'cha ma'muriyatiga murojaat qiling."
        />
      ) : (
        <>
          <SummaryCard summary={summary} loading={summaryQuery.isLoading} />

          <CardSection
            card={card}
            loading={cardQuery.isLoading}
            error={cardQuery.error}
            onRetry={() => cardQuery.refetch()}
            loginHref={`/ota-ona/${slug}/kirish`}
          />

          {childId && card && (
            <SubmitForm childId={childId} remaining={summary?.remainingAmount ?? 0} />
          )}

          <HistorySection
            loading={receiptsQuery.isLoading}
            error={receiptsQuery.isError}
            receipts={receiptsQuery.data ?? []}
          />
        </>
      )}
    </div>
  );
}

/** Qarz xulosasi: qancha to'lash kerak, muddat va tekshiruvdagi cheklar */
function SummaryCard({ summary, loading }: { summary?: ParentPaymentSummary; loading: boolean }) {
  const tr = useTr();
  if (loading) {
    return <div className="mt-4 h-[116px] animate-pulse rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]" />;
  }
  if (!summary) return null;

  const clear = summary.remainingAmount <= 0;
  return (
    <section className="mt-4 rounded-[var(--p-radius)] bg-[var(--p-card)] p-5 shadow-[var(--p-shadow)]">
      <div className="flex items-start gap-3.5">
        <span
          className={clsx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            clear ? "bg-[var(--p-mint)]/15 text-[var(--p-mint)]" : "bg-[var(--p-sun)]/20 text-[var(--p-sun-ink)]",
          )}
        >
          {clear ? <CheckIcon className="h-6 w-6" /> : <WalletIcon className="h-6 w-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--p-muted)]">
            {clear ? tr("Qarzdorlik yo'q") : tr("To'lash kerak")}
          </p>
          <p className="mt-0.5 text-[28px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-[var(--p-ink)]">
            {formatMoney(summary.remainingAmount, summary.currency)}
          </p>
          {!clear && summary.nextDueDate && (
            <p className="mt-2 text-[13px] text-[var(--p-muted)]">
              {tr("Muddat")}: <span className="font-semibold text-[var(--p-ink)]">{formatDateTime(summary.nextDueDate).split(",")[0]}</span>
            </p>
          )}
        </div>
      </div>

      {summary.pendingCount > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-[14px] bg-[var(--p-sun)]/16 px-3.5 py-2.5 text-[13px] leading-snug text-[var(--p-sun-ink)]">
          <ClockIcon className="h-[18px] w-[18px] shrink-0" />
          <span>
            {tr("{0} ta chek tekshiruvda ({1}). Tasdiqlangach qarzdan ayriladi.", String(summary.pendingCount), formatMoney(summary.pendingAmount, summary.currency))}
          </span>
        </p>
      )}
    </section>
  );
}

/** Bog'cha kartasi va nusxalash tugmasi */
function CardSection({
  card,
  loading,
  error,
  onRetry,
  loginHref,
}: {
  card?: PaymentCardInfo | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  loginHref: string;
}) {
  const tr = useTr();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (loading) {
    return <div className="mt-4 aspect-[1.586/1] animate-pulse rounded-[24px] bg-[var(--p-card)] shadow-[var(--p-shadow)]" />;
  }
  if (error) {
    return <LoadErrorCard error={error} onRetry={onRetry} loginHref={loginHref} />;
  }
  if (!card) {
    return (
      <EmptyCard
        Icon={WalletIcon}
        tone="sun"
        title="Karta hali kiritilmagan"
        text="Bog'cha to'lov kartasini kiritgach, u shu yerda ko'rinadi."
      />
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.cardNumber);
      setCopied(true);
    } catch {
      // Nusxalash taqiqlangan bo'lsa — raqam kartada ko'rinib turibdi, qo'lda yoziladi
    }
  };

  return (
    <section className="mt-4">
      <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.07em] text-[var(--p-muted)]">
        {tr("Shu kartaga o'tkazing")}
      </p>
      <CardVisual cardNumber={card.cardNumber} holderName={card.holderName} bankName={card.bankName} />
      <button
        type="button"
        onClick={copy}
        className={clsx(
          "mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[14.5px] font-semibold transition-colors active:scale-[0.99]",
          copied ? "bg-[var(--p-mint)]/15 text-[var(--p-mint)]" : "bg-[var(--p-card)] text-[var(--p-ink)] shadow-[var(--p-shadow)]",
        )}
      >
        {copied ? <CheckIcon className="h-[18px] w-[18px]" /> : <CopyIcon className="h-[18px] w-[18px]" />}
        {copied ? tr("Nusxalandi") : tr("Karta raqamini nusxalash")}
      </button>
      {card.note && (
        <p className="mt-3 rounded-[16px] bg-[var(--p-sky)]/12 px-4 py-3 text-[13.5px] leading-relaxed text-[var(--p-sky-ink)]">
          {card.note}
        </p>
      )}
    </section>
  );
}

/** Summa + chek surati + izoh; yuborilgach moliyachiga tushadi */
function SubmitForm({ childId, remaining }: { childId: string; remaining: number }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      parentApi.post(`/app/parent/children/${childId}/payment-receipts`, {
        amount: Number(amount),
        image,
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: () => {
      setAmount("");
      setNote("");
      setImage(null);
      setError(null);
      setSent(true);
      queryClient.invalidateQueries({ queryKey: ["parent-payment-receipts", childId] });
      queryClient.invalidateQueries({ queryKey: ["parent-payment-summary", childId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Yuborib bo'lmadi — qayta urinib ko'ring")),
  });

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSent(false);
    setPreparing(true);
    try {
      const result = await prepareReceiptPhoto(file);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setImage(result.image);
    } finally {
      setPreparing(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError(tr("To'lagan summangizni kiriting"));
      return;
    }
    if (!image) {
      setError(tr("Chek suratini tanlang"));
      return;
    }
    setError(null);
    setSent(false);
    submit.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 rounded-[var(--p-radius)] bg-[var(--p-card)] p-5 shadow-[var(--p-shadow)]">
      <p className="text-[16px] font-bold text-[var(--p-ink)]">{tr("To'lovni tasdiqlash")}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--p-muted)]">
        {tr("Pulni o'tkazgach, summani yozing va chek suratini yuklang.")}
      </p>

      {sent && (
        <p className="mt-3 flex items-start gap-2.5 rounded-[16px] bg-[var(--p-mint)]/14 px-4 py-3 text-[13.5px] font-medium leading-snug text-[var(--p-mint)]">
          <CheckIcon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
          {tr("Chek yuborildi. Moliyachi tekshirgach to'lov qarzingizdan ayriladi.")}
        </p>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block px-1 text-[12.5px] font-semibold text-[var(--p-muted)]">{tr("To'lagan summa (so'm)")}</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={clsx(FIELD, "text-[18px] font-bold tabular-nums")}
          />
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(Math.round(remaining)))}
              className="mt-2 rounded-full bg-[var(--p-sun)]/18 px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--p-sun-ink)]"
            >
              {tr("Butun qarz: {0}", formatMoney(remaining))}
            </button>
          )}
        </div>

        <div>
          <label className="mb-1.5 block px-1 text-[12.5px] font-semibold text-[var(--p-muted)]">{tr("Chek surati")}</label>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          {image ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative block w-full overflow-hidden rounded-[18px] bg-[var(--p-sunken)]"
              aria-label={tr("Chekni almashtirish")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tanlangan fayl, brauzerda tayyorlangan */}
              <img src={image} alt={tr("Tanlangan chek")} className="max-h-60 w-full object-contain" />
              <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-3 py-1 text-[12px] font-semibold text-white">
                {tr("Almashtirish")}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={preparing}
              className="flex w-full flex-col items-center gap-2 rounded-[18px] border-2 border-dashed border-[var(--p-muted)]/30 px-4 py-6 text-[var(--p-muted)] transition-colors active:bg-[var(--p-sunken)] disabled:opacity-60"
            >
              <CameraIcon className="h-7 w-7" />
              <span className="text-[14px] font-semibold">{preparing ? tr("Tayyorlanmoqda...") : tr("Chek suratini tanlash")}</span>
            </button>
          )}
        </div>

        <div>
          <label className="mb-1.5 block px-1 text-[12.5px] font-semibold text-[var(--p-muted)]">
            {tr("Izoh")} <span className="font-normal">({tr("ixtiyoriy")})</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder={tr("Masalan: may oyi uchun")}
            className={clsx(FIELD, "resize-none text-[14.5px]")}
          />
        </div>
      </div>

      {error && <p className="mt-3 px-1 text-[13px] font-medium text-[var(--p-coral)]">{tr(error)}</p>}

      <button
        type="submit"
        disabled={submit.isPending || preparing}
        className="mt-4 w-full rounded-full bg-[var(--p-sun)] px-5 py-3.5 text-[15.5px] font-bold text-[#3a2a00] shadow-[0_8px_18px_-8px_rgba(255,183,3,0.7)] transition active:scale-[0.99] disabled:opacity-60"
      >
        {submit.isPending ? tr("Yuborilmoqda...") : tr("Chekni yuborish")}
      </button>
    </form>
  );
}

/** Yuborilgan cheklar va ularning holati */
function HistorySection({ receipts, loading, error }: { receipts: ParentPaymentReceipt[]; loading: boolean; error: boolean }) {
  const tr = useTr();
  if (loading) return <div className="mt-6"><ListSkeleton /></div>;
  if (error || receipts.length === 0) return null;

  return (
    <section className="mt-6">
      <p className="mb-2 px-1 text-[12px] font-bold uppercase tracking-[0.07em] text-[var(--p-muted)]">
        {tr("Yuborilgan cheklar")}
      </p>
      <ul className="space-y-2.5">
        {receipts.map((r) => (
          <li key={r.id} className="rounded-[20px] bg-[var(--p-card)] p-4 shadow-[var(--p-shadow)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[17px] font-extrabold tabular-nums text-[var(--p-ink)]">
                {formatMoney(r.claimedAmount, r.currency)}
              </p>
              <span className={clsx("shrink-0 rounded-full px-3 py-1 text-[12px] font-bold", STATUS_TONE[r.status])}>
                {tr(STATUS_LABEL[r.status])}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-[var(--p-muted)]">{formatDateTime(r.createdAt)}</p>
            {r.note && <p className="mt-2 text-[13.5px] leading-snug text-[var(--p-ink)]/85">{r.note}</p>}
            {r.status === "REJECTED" && r.reviewNote && (
              <p className="mt-2 rounded-[12px] bg-[var(--p-coral)]/12 px-3 py-2 text-[13px] leading-snug text-[var(--p-coral)]">
                {r.reviewNote}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
