"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getPaginated, ApiError } from "@/lib/api";
import type { Child, ChildGuardian, LedgerEntry, Payment, PaymentReceipt } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ArrowLeftIcon, ChevronDownIcon, GroupIcon, KeyIcon, PencilIcon, PhoneIcon, WalletIcon } from "@/components/ui/icons";
import { CopyButton } from "@/components/ui/copy-button";
import { ChildPhoto } from "@/components/ui/child-photo";
import { prepareChildPhoto } from "@/lib/child-photo";
import { initials } from "@/components/ui/avatar";
import { formatAge, formatChildId, formatDateTime, formatGender, formatMoney, formatPhone, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/download";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney, canWriteOperational } from "@/lib/permissions";
import { AddGuardianModal } from "@/features/guardians/add-guardian-modal";
import { ParentCabinetModal } from "@/features/guardians/parent-cabinet-modal";
import { EditChildModal } from "@/features/children/edit-child-modal";
import { ReceiptReviewModal } from "@/features/finance/receipt-review-modal";
import { useTr } from "@/i18n/tr";

const LEDGER_TYPE_LABEL: Record<LedgerEntry["type"], string> = {
  CHARGE: "Hisoblandi",
  DISCOUNT: "Chegirma",
  PAYMENT: "To'lov",
  REFUND: "Qaytarish",
  ADJUSTMENT: "Tuzatish",
};

/** "To'lovlar" ro'yxatidagi bitta qator — haqiqiy to'lov yoki ota-ona yuklagan chek. */
type TimelineEntry =
  | { kind: "payment"; createdAt: string; payment: Payment }
  | { kind: "receipt"; createdAt: string; receipt: PaymentReceipt };

/** `2026-09` ko'rinishidagi oy kaliti — mahalliy vaqt bo'yicha, UTC surilishisiz. */
function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_NAME = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAME[m - 1]} ${y}`;
}

const GUARDIAN_RELATION_LABEL: Record<string, string> = {
  FATHER: "Ota",
  MOTHER: "Ona",
  GRANDPARENT: "Bobo/Buvi",
  OTHER: "Boshqa",
};

/** Bolaning bitta fakti — sarlavha ostidagi to'rt katakli qatordan biri. */
function Fact({
  label,
  value,
  hint,
  muted,
  numeric,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
  numeric?: boolean;
}) {
  const tr = useTr();
  return (
    <div className="px-5 py-3.5 sm:px-6">
      <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">{tr(label)}</dt>
      <dd
        className={clsx(
          "mt-1 truncate text-[15px] font-medium",
          numeric && "tabular-nums",
          muted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text)]",
        )}
      >
        {tr(value)}
      </dd>
      {hint && <p className="text-[12px] text-[var(--color-text-muted)]">{tr(hint)}</p>}
    </div>
  );
}

export default function ChildFinancePage({ params }: { params: Promise<{ slug: string; childId: string }> }) {
  const tr = useTr();
  const { slug, childId } = use(params);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  // Bola profilini tahrirlash (surat, asosiy ma'lumot, ota-ona) — moliya emas,
  // operatsion huquq. Moliyachida bu yo'q, faqat ko'radi.
  const canWriteChild = canWriteOperational(user?.role);
  const { branchSlug } = useBranchContext(slug);
  const financeHref = branchSlug ? `/${slug}/${branchSlug}/finance` : `/${slug}/finance`;
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const [docLoading, setDocLoading] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoChecking, setPhotoChecking] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editChildOpen, setEditChildOpen] = useState(false);
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [cabinetOpen, setCabinetOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<TimelineEntry | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const handleReceipt = async (paymentId: string) => {
    setDownloadingReceiptId(paymentId);
    setReceiptError(null);
    try {
      await downloadCsv(`/app/exports/payments/${paymentId}/pdf`, `tolov-kvitansiyasi-${paymentId}.pdf`);
    } catch {
      setReceiptError(tr("Kvitansiya yuklab bo'lmadi — qayta urinib ko'ring"));
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const childQuery = useQuery({
    queryKey: ["child", slug, childId],
    queryFn: () => api.get<Child>(`/app/children/${childId}`),
  });

  const guardiansQuery = useQuery({
    queryKey: ["child-guardians", slug, childId],
    queryFn: () => api.get<ChildGuardian[]>(`/app/children/${childId}/guardians`),
  });

  const ledgerQuery = useQuery({
    queryKey: ["ledger", slug, childId],
    queryFn: () => api.get<LedgerEntry[]>(`/app/children/${childId}/ledger`),
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", slug, childId],
    queryFn: () => getPaginated<Payment>(`/app/payments?childId=${childId}&limit=100`),
  });

  const receiptsQuery = useQuery({
    queryKey: ["payment-receipts", slug, childId],
    queryFn: () => api.get<PaymentReceipt[]>(`/app/children/${childId}/payment-receipts`),
  });

  const refundMutation = useMutation({
    mutationFn: (paymentId: string) => api.post(`/app/payments/${paymentId}/refund`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger", slug, childId] });
      queryClient.invalidateQueries({ queryKey: ["payments", slug, childId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
    },
    onError: (err) => alert(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik")),
  });

  const photoMutation = useMutation({
    mutationFn: (image: string) => api.put(`/app/children/${childId}/avatar`, { image }),
    onSuccess: () => {
      setPhotoError(null);
      queryClient.invalidateQueries({ queryKey: ["child", slug, childId] });
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
    },
    onError: (err) => setPhotoError(err instanceof ApiError ? err.message : tr("Suratni saqlab bo'lmadi")),
  });

  const removePhotoMutation = useMutation({
    mutationFn: () => api.delete(`/app/children/${childId}/avatar`),
    onSuccess: () => {
      setPhotoError(null);
      queryClient.invalidateQueries({ queryKey: ["child", slug, childId] });
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
    },
    onError: (err) => setPhotoError(err instanceof ApiError ? err.message : tr("Suratni o'chirib bo'lmadi")),
  });

  const handlePhotoPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setPhotoChecking(true);
    try {
      const result = await prepareChildPhoto(file);
      if (!result.ok) {
        setPhotoError(result.reason);
        return;
      }
      photoMutation.mutate(result.image);
    } finally {
      setPhotoChecking(false);
    }
  };

  // Kabinet bolaga bitta: qaysi vasiyning raqami login ekanini shu yerda topamiz
  const cabinetHolder = guardiansQuery.data?.find((link) => link.guardian.hasCabinet) ?? null;

  // "To'lovlar" ro'yxati haqiqiy to'lovlar bilan ota-ona yuklagan cheklarni
  // (holati qanday bo'lishidan qat'i nazar) bitta vaqt chizig'iga birlashtiradi
  // — chek ham xuddi to'lovdek qatorda turadi, faqat bosilganda batafsili ochiladi.
  // Faqat joriy oy ko'rinadi, o'tganlari pastdagi "To'lov tarixi"ga oy bo'yicha tushadi.
  const currentMonthKey = monthKey(new Date().toISOString());
  const allPayments = paymentsQuery.data?.data ?? [];
  // Tasdiqlangan chek natijasida yaratilgan haqiqiy To'lov qatorda alohida
  // ko'rinadi — o'sha chekni yana qo'shsak, bitta pul bir marta emas, ikki
  // marta ko'ringandek bo'lardi. Shuning uchun bu yerga faqat hali hal
  // qilinmagan yoki rad etilgan cheklar qo'shiladi.
  const openReceipts = (receiptsQuery.data ?? []).filter((r) => r.status !== "APPROVED");
  // Tasdiqlangan to'lovning "Batafsil"ida asl chek surati ham ko'rinishi
  // uchun — qaysi Payment qaysi PaymentReceipt'dan kelib chiqqanini shu
  // xaritadan topamiz.
  const receiptByPaymentId = new Map(
    (receiptsQuery.data ?? []).filter((r) => r.paymentId).map((r) => [r.paymentId as string, r]),
  );
  const timeline: TimelineEntry[] = [
    ...allPayments.map((payment): TimelineEntry => ({ kind: "payment", createdAt: payment.createdAt, payment })),
    ...openReceipts.map((receipt): TimelineEntry => ({ kind: "receipt", createdAt: receipt.createdAt, receipt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const currentMonthEntries = timeline.filter((e) => monthKey(e.createdAt) === currentMonthKey);
  const historyByMonth = new Map<string, TimelineEntry[]>();
  for (const entry of timeline) {
    const key = monthKey(entry.createdAt);
    if (key === currentMonthKey) continue;
    historyByMonth.set(key, [...(historyByMonth.get(key) ?? []), entry]);
  }
  const historyMonths = [...historyByMonth.keys()].sort().reverse();

  if (childQuery.isLoading) return <LoadingState />;
  if (childQuery.isError) return <ErrorState message={tr((childQuery.error as Error).message)} />;
  const child = childQuery.data;
  if (!child) return null;

  return (
    <div className="space-y-5">
      <Link
        href={financeHref}
        className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
        {tr("Moliya")}
      </Link>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 px-5 py-5 sm:px-6">
          <div className="group relative shrink-0">
            <ChildPhoto child={child} size={72} fallback={initials(child.fullName)} />
            {canWriteChild && (
              <>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoChecking || photoMutation.isPending}
                  aria-label={tr("Bolaning suratini almashtirish")}
                  title={tr("Suratni almashtirish")}
                  className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-[var(--dur-fast)] hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none disabled:cursor-wait disabled:opacity-100 motion-reduce:transition-none"
                >
                  {photoChecking || photoMutation.isPending ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <PencilIcon className="h-5 w-5" />
                  )}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handlePhotoPick}
                />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] font-semibold leading-tight tracking-[var(--tracking-title)] text-[var(--color-text)]">
                {tr(child.fullName)}
              </h1>
              <Badge tone={child.status === "ACTIVE" ? "success" : child.status === "QUARANTINED" ? "danger" : "neutral"}>
                {child.status === "ACTIVE" ? "Faol" : child.status === "QUARANTINED" ? "Karantinda" : "Nofaol"}
              </Badge>
              {canWriteChild && (
                <Button size="sm" variant="outline" onClick={() => setEditChildOpen(true)}>
                  {tr("Tahrirlash")}
                </Button>
              )}
              {canWriteChild && (
                <>
                  {(["contract", "certificate"] as const).map((kind) => (
                    <Button
                      key={kind}
                      size="sm"
                      variant="outline"
                      loading={docLoading === kind}
                      onClick={async () => {
                        setDocLoading(kind);
                        setDocError(null);
                        try {
                          await downloadCsv(`/app/exports/children/${childId}/${kind}-pdf`, `${kind === "contract" ? "shartnoma" : "malumotnoma"}-${childId}.pdf`);
                        } catch {
                          setDocError(tr("Hujjatni yuklab bo'lmadi — qayta urinib ko'ring"));
                        } finally {
                          setDocLoading(null);
                        }
                      }}
                    >
                      {kind === "contract" ? "Shartnoma (PDF)" : tr("Ma'lumotnoma (PDF)")}
                    </Button>
                  ))}
                  {docError && <span className="text-[12.5px] text-[var(--color-danger)]">{tr(docError)}</span>}
                </>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[var(--color-surface-sunken)] px-2.5 py-1 text-[12px] font-semibold tabular-nums text-[var(--color-text-muted)]">
                {formatChildId(child.publicId)}
              </span>
              <CopyButton value={formatChildId(child.publicId)} label={tr("ID nusxalash")} />
              {canWriteChild && (
                <>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoChecking || photoMutation.isPending}
                    className="cursor-pointer text-[12.5px] font-medium text-[var(--color-primary)] hover:underline disabled:opacity-60"
                  >
                    {photoChecking ? "Tekshirilmoqda..." : child.avatarUpdatedAt ? "Suratni almashtirish" : tr("Surat qo'yish")}
                  </button>
                  {child.avatarUpdatedAt && (
                    <>
                      <span className="text-[12.5px] text-[var(--color-text-muted)]">·</span>
                      <button
                        type="button"
                        onClick={() => removePhotoMutation.mutate()}
                        disabled={removePhotoMutation.isPending}
                        className="cursor-pointer text-[12.5px] font-medium text-[var(--color-danger)] hover:underline disabled:opacity-60"
                      >
                        {tr("O'chirish")}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            {photoError && (
              <p role="alert" className="mt-1.5 max-w-[420px] text-[12.5px] text-[var(--color-danger)]">
                {tr(photoError)}
              </p>
            )}
            {canWriteChild && !photoError && !child.avatarUpdatedAt && (
              <p className="mt-1.5 text-[12px] text-[var(--color-text-muted)]">
                {tr("Yuzi ko'rinib turgan surat, 3 MB gacha")}
              </p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--color-separator)] border-t border-[var(--color-separator)] sm:grid-cols-4 sm:divide-y-0">
          <Fact label={tr("Filial")} value={child.branch?.name ?? "—"} />
          <Fact label={tr("Guruh")} value={child.group?.name ?? "Guruhsiz"} muted={!child.group} />
          <Fact label={tr("Jinsi")} value={formatGender(child.gender)} muted={!child.gender} />
          <Fact
            label={tr("Tug'ilgan sana")}
            value={child.birthDate ? formatDate(child.birthDate) : "—"}
            hint={child.birthDate ? formatAge(child.birthDate) : undefined}
            numeric
          />
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <div className="hairline flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-separator)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-text)]">
              {tr("Bog'langan ota-ona")}
            </h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr("Telefon raqamini bosib nusxalang")}</p>
          </div>
          {canWriteChild && guardiansQuery.isSuccess && guardiansQuery.data.length === 0 && (
            <Button size="sm" variant="outline" onClick={() => setGuardianOpen(true)}>
              {tr("+ Ota-ona qo'shish")}
            </Button>
          )}
        </div>
        {guardiansQuery.isLoading ? (
          <div className="px-5 py-5 sm:px-6">
            <LoadingState rows={2} />
          </div>
        ) : guardiansQuery.isError ? (
          <div className="px-5 py-5 sm:px-6">
            <ErrorState message={tr((guardiansQuery.error as Error).message)} />
          </div>
        ) : !guardiansQuery.data || guardiansQuery.data.length === 0 ? (
          <div className="px-5 py-5 sm:px-6">
            <EmptyState
              title={tr("Hali ota-ona biriktirilmagan")}
              description={canWriteChild ? tr("Bola bilan bog'lanish uchun ota-ona qo'shing") : undefined}
              icon={<GroupIcon className="h-[26px] w-[26px]" />}
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-separator)]">
            {guardiansQuery.data.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[12px] font-semibold text-[var(--color-primary)]">
                  {initials(link.guardian.fullName)}
                </span>
                <div className="min-w-0 flex-1 basis-[10rem]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[15px] font-medium text-[var(--color-text)]">
                      {tr(link.guardian.fullName)}
                    </p>
                    {link.isPrimary && <Badge tone="primary">{tr("Asosiy")}</Badge>}
                    {link.guardian.hasCabinet && <Badge tone="success">{tr("Kabinet logini")}</Badge>}
                  </div>
                  <p className="text-[12.5px] text-[var(--color-text-muted)]">
                    {tr(GUARDIAN_RELATION_LABEL[link.relation])}
                    {link.canPickup && " · olib ketadi"}
                  </p>
                </div>
                <div className="flex items-center gap-1 max-sm:ml-[52px]">
                  <a
                    href={`tel:${link.guardian.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-sunken)] px-3 py-1.5 text-[14px] font-medium tabular-nums text-[var(--color-text)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]"
                  >
                    <PhoneIcon className="h-3.5 w-3.5" />
                    {formatPhone(link.guardian.phone)}
                  </a>
                  <CopyButton value={link.guardian.phone} label={tr("Telefon raqamini nusxalash")} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {canWriteChild && guardiansQuery.data && guardiansQuery.data.length > 0 && (
          <div className="hairline flex flex-wrap items-center gap-3 border-t border-[var(--color-separator)] bg-[var(--color-surface-sunken)]/60 px-5 py-3.5 sm:px-6">
            <span
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                cabinetHolder
                  ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                  : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
              )}
            >
              <KeyIcon className="h-[17px] w-[17px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[var(--color-text)]">
                {cabinetHolder ? "Kabinet ochiq" : "Kabinet ochilmagan"}
              </p>
              <p className="truncate text-[12.5px] text-[var(--color-text-muted)]">
                {cabinetHolder
                  ? tr("Login: {0} · ota-ona ikkalasi shu kabinetdan foydalanadi", formatPhone(cabinetHolder.guardian.phone))
                  : tr("Ota-ona davomat, ovqat va mashg'ulotlarni ko'rishi uchun kabinet oching")}
              </p>
            </div>
            <Button size="sm" variant={cabinetHolder ? "outline" : "primary"} onClick={() => setCabinetOpen(true)}>
              {cabinetHolder ? "Boshqarish" : "Kabinet ochish"}
            </Button>
          </div>
        )}
      </Card>

      {receiptError && (
        <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {tr(receiptError)}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{tr("To'lovlar")}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {paymentsQuery.isLoading || receiptsQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={3} />
            </div>
          ) : paymentsQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={tr((paymentsQuery.error as Error).message)} />
            </div>
          ) : currentMonthEntries.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState
                title={tr("Bu oy to'lov yo'q")}
                description={tr("Joriy oy uchun hali to'lov qayd etilmagan")}
                icon={<WalletIcon className="h-[26px] w-[26px]" />}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-separator)]">
              {currentMonthEntries.map((entry) => (
                <TimelineRow
                  key={entry.kind === "payment" ? `p-${entry.payment.id}` : `r-${entry.receipt.id}`}
                  entry={entry}
                  onOpen={() => setDetailEntry(entry)}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {historyMonths.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{tr("To'lov tarixi")}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--color-separator)]">
              {historyMonths.map((key) => {
                const monthEntries = historyByMonth.get(key) ?? [];
                const total = monthEntries
                  .filter((e): e is Extract<TimelineEntry, { kind: "payment" }> => e.kind === "payment")
                  .reduce((sum, e) => sum + Number(e.payment.amount), 0);
                const expanded = expandedMonths.has(key);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMonths((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                      className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--color-surface-hover)] sm:px-6"
                    >
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium capitalize text-[var(--color-text)]">
                          {monthLabel(key)}
                        </span>
                        <span className="block text-[12.5px] text-[var(--color-text-muted)]">
                          {tr(monthEntries.length)} {tr("ta yozuv ·")}{" "}{formatMoney(total)}
                        </span>
                      </span>
                      <ChevronDownIcon
                        className={clsx(
                          "h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </button>
                    {expanded && (
                      <ul className="divide-y divide-[var(--color-separator)] border-t border-[var(--color-separator)] bg-[var(--color-surface-sunken)]/40">
                        {monthEntries.map((entry) => (
                          <TimelineRow
                            key={entry.kind === "payment" ? `p-${entry.payment.id}` : `r-${entry.receipt.id}`}
                            entry={entry}
                            onOpen={() => setDetailEntry(entry)}
                          />
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{tr("Moliyaviy tarix (ledger)")}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {ledgerQuery.isLoading ? (
            <div className="px-5 py-5 sm:px-6">
              <LoadingState rows={5} />
            </div>
          ) : ledgerQuery.isError ? (
            <div className="px-5 py-5 sm:px-6">
              <ErrorState message={tr((ledgerQuery.error as Error).message)} />
            </div>
          ) : !ledgerQuery.data || ledgerQuery.data.length === 0 ? (
            <div className="px-5 py-5 sm:px-6">
              <EmptyState title={tr("Yozuvlar yo'q")} />
            </div>
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <Th>{tr("Sana")}</Th>
                  <Th>{tr("Turi")}</Th>
                  <Th numeric>{tr("Summa")}</Th>
                  <Th>{tr("Davr")}</Th>
                  <Th>{tr("Izoh")}</Th>
                </tr>
              </THead>
              <TBody>
                {ledgerQuery.data.map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDateTime(entry.createdAt)}</Td>
                    <Td>{tr(LEDGER_TYPE_LABEL[entry.type])}</Td>
                    <Td
                      numeric
                      className={`font-medium ${Number(entry.amount) < 0 ? "text-[var(--color-success)]" : "text-[var(--color-text)]"}`}
                    >
                      {Number(entry.amount) > 0 ? "+" : ""}
                      {formatMoney(entry.amount)}
                    </Td>
                    <Td className="tabular-nums text-[var(--color-text-muted)]">{entry.invoice?.period ?? "—"}</Td>
                    <Td className="text-[var(--color-text-muted)]">{entry.note ?? "—"}</Td>
                  </Tr>
                ))}
              </TBody>
            </DataTable>
          )}
        </CardBody>
      </Card>

      {canWriteChild && editChildOpen && (
        <EditChildModal open={editChildOpen} onClose={() => setEditChildOpen(false)} slug={slug} child={child} />
      )}

      {canWriteChild && guardianOpen && (
        <AddGuardianModal open={guardianOpen} onClose={() => setGuardianOpen(false)} slug={slug} childId={childId} />
      )}

      {canWriteChild && cabinetOpen && (
        <ParentCabinetModal
          open={cabinetOpen}
          onClose={() => setCabinetOpen(false)}
          slug={slug}
          childId={childId}
          childName={child.fullName}
          links={guardiansQuery.data ?? []}
        />
      )}

      {detailEntry && (
        <ReceiptReviewModal
          open={!!detailEntry}
          onClose={() => setDetailEntry(null)}
          slug={slug}
          childId={childId}
          payment={detailEntry.kind === "payment" ? detailEntry.payment : undefined}
          receipt={
            detailEntry.kind === "receipt" ? detailEntry.receipt : receiptByPaymentId.get(detailEntry.payment.id)
          }
          canWrite={canWrite}
          downloadingReceiptId={downloadingReceiptId}
          onDownloadReceipt={handleReceipt}
          refundingId={refundMutation.isPending ? refundMutation.variables : undefined}
          onRefund={(id) => refundMutation.mutate(id)}
        />
      )}
    </div>
  );
}

/**
 * "To'lovlar" ro'yxatidagi bitta qator — haqiqiy to'lov yoki ota-ona yuklagan
 * chek bo'lishi mumkin. Faqat summa va sana ko'rinadi; qolgan hammasi
 * (chek surati, xizmat turi, tasdiqlash/qaytarish) "Batafsil" bosilganda
 * ochiladigan oynada.
 */
function TimelineRow({ entry, onOpen }: { entry: TimelineEntry; onOpen: () => void }) {
  const tr = useTr();
  const amount = entry.kind === "payment" ? entry.payment.amount : entry.receipt.claimedAmount;
  const currency = entry.kind === "payment" ? entry.payment.currency : entry.receipt.currency;
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-surface-hover)] sm:px-6">
      <div className="min-w-0">
        <p className="text-[14px] font-medium tabular-nums text-[var(--color-text)]">{formatMoney(amount, currency)}</p>
        <p className="text-[12.5px] text-[var(--color-text-muted)]">{formatDateTime(entry.createdAt)}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}>
        {tr("Batafsil")}
      </Button>
    </li>
  );
}
