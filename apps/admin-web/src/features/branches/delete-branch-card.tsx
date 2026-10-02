"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Branch } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TrashIcon } from "@/components/ui/icons";
import { useTr } from "@/i18n/tr";

interface DeletionSummary {
  children: number;
  employees: number;
  users: number;
  groups: number;
  invoices: number;
  payments: number;
  isLastBranch: boolean;
}

/**
 * Filialni butunlay o'chirish (faqat Super Admin). Qaytarib bo'lmaydi —
 * oynada filialda nima borligi ko'rsatiladi va filial nomini aynan yozib
 * tasdiqlash so'raladi (API ham nomni tekshiradi).
 */
export function DeleteBranchCard({ slug, branch }: { slug: string; branch: Branch }) {
  const tr = useTr();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["branch-deletion-summary", slug, branch.id],
    queryFn: () => api.get<DeletionSummary>(`/app/organizations/me/branches/${branch.id}/deletion-summary`),
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      api.delete(`/app/organizations/me/branches/${branch.id}`, { body: JSON.stringify({ confirmName }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", slug] });
      queryClient.invalidateQueries({ queryKey: ["tenant-users", slug] });
      queryClient.removeQueries({ queryKey: ["branch", slug, branch.id] });
      router.replace(`/${slug}/branches`);
    },
  });

  const close = () => {
    if (deleteMutation.isPending) return;
    setOpen(false);
    setConfirmName("");
    deleteMutation.reset();
  };

  const summary = summaryQuery.data;
  const nameMatches = confirmName.trim() === branch.name.trim();
  const items = summary
    ? [
        { label: tr("bola"), value: summary.children },
        { label: tr("xodim"), value: summary.employees },
        { label: tr("guruh"), value: summary.groups },
        { label: tr("kabinet (login)"), value: summary.users },
        { label: tr("hisob-faktura"), value: summary.invoices },
        { label: tr("to'lov"), value: summary.payments },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[var(--tracking-headline)] text-[var(--color-danger)]">
              {tr("Filialni o'chirish")}
            </h2>
            <p className="text-[12.5px] text-[var(--color-text-muted)]">
              {tr("Filial va undagi barcha ma'lumotlar butunlay o'chiriladi — qaytarib bo'lmaydi.")}
            </p>
          </div>
          <Button size="sm" variant="dangerSoft" onClick={() => setOpen(true)}>
            <TrashIcon className="h-4 w-4" />
            {tr("Filialni o'chirish")}
          </Button>
        </div>
      </Card>

      <Modal open={open} onClose={close} title={tr("Filialni o'chirish")}>
        <div className="space-y-4 text-[14px] leading-relaxed text-[var(--color-text-muted)]">
          {summaryQuery.isLoading ? (
            <p>{tr("Yuklanmoqda...")}</p>
          ) : summaryQuery.isError ? (
            <p className="text-[var(--color-danger)]">
              {summaryQuery.error instanceof ApiError ? tr(summaryQuery.error.message) : tr("Kutilmagan xatolik yuz berdi")}
            </p>
          ) : summary?.isLastBranch ? (
            <p>{tr("Bu bog'chaning yagona filiali — oxirgi filialni o'chirib bo'lmaydi.")}</p>
          ) : (
            <>
              <p>
                <b className="text-[var(--color-text)]">{tr(branch.name)}</b>{" "}
                {tr("filiali va undagi hamma narsa — davomat, moliya, kundalik, Face ID, filial xodimlarining kabinetlari — butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.")}
              </p>
              {items.length > 0 && (
                <div className="rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3.5 py-3 text-[13.5px] text-[var(--color-danger)]">
                  {tr("O'chiriladi:")}{" "}
                  {items.map((item) => `${item.value} ${item.label}`).join(", ")}
                </div>
              )}
              <Input
                label={tr("Tasdiqlash uchun filial nomini yozing: {0}", branch.name)}
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                autoComplete="off"
                placeholder={branch.name}
              />
              {deleteMutation.error && (
                <p className="text-[13px] text-[var(--color-danger)]">
                  {deleteMutation.error instanceof ApiError ? tr(deleteMutation.error.message) : tr("Kutilmagan xatolik yuz berdi")}
                </p>
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={deleteMutation.isPending}>
              {tr("Bekor qilish")}
            </Button>
            {summary && !summary.isLastBranch && (
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate()}
                disabled={!nameMatches}
                loading={deleteMutation.isPending}
              >
                {tr("Butunlay o'chirish")}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
