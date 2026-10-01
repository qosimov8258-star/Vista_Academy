"use client";

import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteMoney } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DataTable, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { formatDate, formatMoney } from "@/lib/format";
import type { PaymentReminderSettings, UnpaidReminderChild } from "@/lib/types";
import { useTr } from "@/i18n/tr";

const DEFAULT_MESSAGE =
  "Hurmatli ota-ona! {childName} uchun to'lov muddati {dueDate}. Iltimos, to'lovni amalga oshiring.";

interface FormState {
  isEnabled: boolean;
  daysBeforeDue: number;
  daysAfterDue: number;
  sendTimes: string[];
  messageTemplate: string;
}

export default function RemindersPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteMoney(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const queryClient = useQueryClient();

  const qs = forcedBranchId ? `?branchId=${forcedBranchId}` : "";

  const settingsQuery = useQuery({
    queryKey: ["reminder-settings", slug, forcedBranchId],
    queryFn: () => api.get<PaymentReminderSettings>(`/app/finance/reminder-settings${qs}`),
  });

  const unpaidQuery = useQuery({
    queryKey: ["reminder-unpaid-children", slug, forcedBranchId],
    queryFn: () => api.get<UnpaidReminderChild[]>(`/app/finance/reminder-settings/unpaid-children${qs}`),
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState(false);

  // Server javobi kelgach formani bir marta to'ldiramiz — keyingi refetch'lar
  // (masalan saqlashdan keyingi invalidate) foydalanuvchi terayotgan qiymatni bosib ketmasin.
  useEffect(() => {
    if (settingsQuery.data && !form) {
      setForm({
        isEnabled: settingsQuery.data.isEnabled,
        daysBeforeDue: settingsQuery.data.daysBeforeDue,
        daysAfterDue: settingsQuery.data.daysAfterDue,
        sendTimes: settingsQuery.data.sendTimes.length > 0 ? settingsQuery.data.sendTimes : ["09:00"],
        messageTemplate: settingsQuery.data.messageTemplate || DEFAULT_MESSAGE,
      });
    }
  }, [settingsQuery.data, form]);

  const saveMutation = useMutation({
    mutationFn: (data: FormState) => api.put<PaymentReminderSettings>(`/app/finance/reminder-settings${qs}`, data),
    onSuccess: (data) => {
      queryClient.setQueryData(["reminder-settings", slug, forcedBranchId], data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const addTime = () => {
    if (!form || form.sendTimes.length >= 6) return;
    setForm({ ...form, sendTimes: [...form.sendTimes, "09:00"] });
  };
  const removeTime = (index: number) => {
    if (!form || form.sendTimes.length <= 1) return;
    setForm({ ...form, sendTimes: form.sendTimes.filter((_, i) => i !== index) });
  };
  const updateTime = (index: number, value: string) => {
    if (!form) return;
    setForm({ ...form, sendTimes: form.sendTimes.map((t, i) => (i === index ? value : t)) });
  };

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">{tr("Eslatmalar")}</h1>
        <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
          {tr("To'lov muddati yaqinlashganda yoki o'tib ketganda ota-ona kabinetida avtomatik chiqadigan eslatma karta")}
        </p>
      </div>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {settingsQuery.isLoading || !form ? (
        <LoadingState rows={4} />
      ) : settingsQuery.isError ? (
        <ErrorState message={tr((settingsQuery.error as Error).message)} />
      ) : (
        <Card className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Eslatma yoqilgan")}</p>
              <p className="text-[13px] text-[var(--color-text-muted)]">{tr("O'chirilsa, ota-ona kabinetida karta chiqmaydi")}</p>
            </div>
            <Switch
              checked={form.isEnabled}
              onChange={() => canWrite && setForm({ ...form, isEnabled: !form.isEnabled })}
              disabled={!canWrite}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="number"
              min={0}
              max={60}
              label={tr("Necha kun oldin boshlansin")}
              hint={tr("To'lov muddatiga shuncha kun qolganda karta chiqa boshlaydi")}
              value={form.daysBeforeDue}
              disabled={!canWrite}
              onChange={(e) => setForm({ ...form, daysBeforeDue: Number(e.target.value) })}
            />
            <Input
              type="number"
              min={0}
              max={60}
              label={tr("Necha kun kechikkuncha davom etsin")}
              hint={tr("Muddat o'tgach ham shuncha kun 'kechikdi' deb ko'rsatiladi")}
              value={form.daysAfterDue}
              disabled={!canWrite}
              onChange={(e) => setForm({ ...form, daysAfterDue: Number(e.target.value) })}
            />
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-[var(--color-text)]">
              {tr("Kuniga necha marta va soat nechada yuborilsin")}
            </p>
            <div className="flex flex-wrap gap-2">
              {form.sendTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={t}
                    disabled={!canWrite}
                    onChange={(e) => updateTime(i, e.target.value)}
                    className="h-11 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12]"
                  />
                  {canWrite && form.sendTimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(i)}
                      className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                      aria-label={tr("O'chirish")}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {canWrite && form.sendTimes.length < 6 && (
                <Button variant="outline" size="sm" onClick={addTime} type="button">
                  {tr("+ Vaqt qo'shish")}
                </Button>
              )}
            </div>
          </div>

          <Textarea
            label={tr("Eslatma matni")}
            hint={tr("Ishlatsa bo'ladigan o'rin bosuvchilar: {childName}, {amount}, {dueDate}, {daysLeft}")}
            rows={3}
            maxLength={1000}
            value={form.messageTemplate}
            disabled={!canWrite}
            onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
          />

          {saveMutation.isError && (
            <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {saveMutation.error instanceof ApiError ? saveMutation.error.message : tr("Saqlab bo'lmadi")}
            </div>
          )}

          {canWrite && (
            <div className="flex items-center gap-3">
              <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
                {tr("Saqlash")}
              </Button>
              {saved && <span className="text-[13px] text-[var(--color-success)]">{tr("Saqlandi")}</span>}
            </div>
          )}
        </Card>
      )}

      <div>
        <h2 className="text-[16px] font-semibold text-[var(--color-text)]">{tr("To'lov qilmagan o'quvchilar")}</h2>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">{tr("Hozirgi eslatma oynasiga tushayotganlar")}</p>
      </div>

      {unpaidQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : unpaidQuery.isError ? (
        <ErrorState message={tr((unpaidQuery.error as Error).message)} />
      ) : !unpaidQuery.data || unpaidQuery.data.length === 0 ? (
        <Card>
          <EmptyState title={tr("Hozircha hech kim yo'q")} description={tr("Barcha o'quvchilar to'lovini amalga oshirgan")} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <DataTable>
            <THead>
              <tr>
                <Th>{tr("Bola")}</Th>
                <Th>{tr("Guruh")}</Th>
                <Th>{tr("Muddat")}</Th>
                <Th numeric>{tr("Qoldiq")}</Th>
                <Th>{tr("Holat")}</Th>
              </tr>
            </THead>
            <TBody>
              {unpaidQuery.data.map((row) => (
                <Tr key={row.invoiceId}>
                  <Td className="font-medium">{tr(row.childFullName)}</Td>
                  <Td className="text-[var(--color-text-muted)]">{row.groupName ?? "—"}</Td>
                  <Td className="tabular-nums text-[var(--color-text-muted)]">{formatDate(row.dueDate)}</Td>
                  <Td numeric className="font-medium">{formatMoney(row.remainingAmount)}</Td>
                  <Td>
                    {row.daysUntilDue < 0 ? (
                      <Badge tone="danger">{Math.abs(row.daysUntilDue)} {tr("kun kechikdi")}</Badge>
                    ) : (
                      <Badge tone="warning">{tr(row.daysUntilDue)} {tr("kun qoldi")}</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </DataTable>
        </Card>
      )}
    </div>
  );
}
