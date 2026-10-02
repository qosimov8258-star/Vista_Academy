"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Organization, OrganizationUsage } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { AlertIcon } from "@/components/ui/icons";
import { formatDayMonth, formatNumber } from "@/lib/format";
import { organizationAccessUrl } from "@/lib/admin-web";

/** Bog'cha holati o'zgarganda yangilanadigan hamma so'rovlar. */
export function useInvalidateOrganization(id: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
    queryClient.invalidateQueries({ queryKey: ["organization-usage", id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export const ORG_STATUS_LABEL: Record<Organization["status"], string> = {
  ACTIVE: "Faol",
  SUSPENDED: "To'xtatilgan",
  ARCHIVED: "Arxivda",
};

export function OrgStatusPill({ status }: { status: Organization["status"] }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold",
        status === "ACTIVE" && "bg-[var(--color-success-bg)] text-[var(--color-success)]",
        status === "SUSPENDED" && "bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
        status === "ARCHIVED" && "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ORG_STATUS_LABEL[status]}
    </span>
  );
}

// ─── Foydalanish ────────────────────────────────────────────────────────────

/** Limit 0 yoki juda katta (999999) — amalda cheksiz. */
const isUnlimited = (limit: number | null | undefined) => !limit || limit >= 99999;

function UsageTile({ label, value, limit }: { label: string; value: number; limit?: number | null }) {
  const unlimited = limit === undefined || isUnlimited(limit);
  const ratio = unlimited ? 0 : value / (limit as number);
  const over = !unlimited && ratio > 1;
  const near = !unlimited && ratio >= 0.85 && !over;
  return (
    <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13.5px] text-[var(--color-text-muted)]">{label}</p>
        {over && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-danger)]">
            <AlertIcon className="h-3.5 w-3.5" />
            limitdan oshgan
          </span>
        )}
      </div>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--color-text)]">{formatNumber(value)}</span>
        <span className="text-[13px] text-[var(--color-text-muted)]">
          {limit === undefined ? "" : unlimited ? "/ cheksiz" : `/ ${formatNumber(limit as number)}`}
        </span>
      </p>
      {limit !== undefined && !unlimited && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={limit as number}
          aria-valuenow={value}
          aria-label={label}
        >
          <div
            className={clsx(
              "h-full rounded-full transition-[width] duration-700",
              over ? "bg-[var(--color-danger)]" : near ? "bg-[var(--color-warning)]" : "bg-[var(--color-accent-muted)]",
            )}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function UsageTiles({ usage }: { usage: OrganizationUsage }) {
  const plan = usage.plan;
  return (
    <section aria-label="Foydalanish" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <UsageTile label="Filiallar" value={usage.counts.branches} limit={plan ? plan.maxBranches : null} />
      <UsageTile label="Faol bolalar" value={usage.counts.children} limit={plan ? plan.maxChildren : null} />
      <UsageTile label="Faol xodimlar" value={usage.counts.employees} limit={plan ? plan.maxEmployees : null} />
      <UsageTile label="Ota-onalar" value={usage.counts.guardians} />
    </section>
  );
}

export function BranchesCard({ usage }: { usage: OrganizationUsage }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h2 className="text-[17px] font-medium text-[var(--color-text)]">Filiallar</h2>
        <span className="text-[13px] text-[var(--color-text-muted)]">
          {usage.counts.groups} guruh · {usage.counts.staffAccounts} ta kabinet
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead>
            <tr className="border-y border-[var(--color-border)] text-[13.5px] text-[var(--color-text-muted)]">
              <th className="px-5 py-2.5 font-normal">Filial</th>
              <th className="px-3 py-2.5 text-right font-normal">Bolalar</th>
              <th className="px-3 py-2.5 text-right font-normal">Xodimlar</th>
              <th className="px-3 py-2.5 text-right font-normal">Guruhlar</th>
              <th className="px-5 py-2.5 font-normal">Ochilgan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-separator)]">
            {usage.branches.map((branch) => (
              <tr key={branch.id} className="text-[13.5px]">
                <td className="px-5 py-3">
                  <p className="font-medium text-[var(--color-text)]">{branch.name}</p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">{branch.address || `/${branch.slug}`}</p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">{formatNumber(branch.children)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">{formatNumber(branch.employees)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-[var(--color-text)]">{formatNumber(branch.groups)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-[var(--color-text-muted)]">{formatDayMonth(branch.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminsCard({ usage }: { usage: OrganizationUsage }) {
  return (
    <section className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-[17px] font-medium text-[var(--color-text)]">Super Adminlar</h2>
      <p className="text-[12.5px] text-[var(--color-text-muted)]">
        Oxirgi faollik: {usage.lastLoginAt ? formatDayMonth(usage.lastLoginAt) : "hali kirilmagan"}
      </p>
      <ul className="mt-3 space-y-2">
        {usage.admins.map((admin) => (
          <li key={admin.id} className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--color-surface-sunken)] px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-[var(--color-text)]">{admin.fullName}</p>
              <p className="truncate text-[12px] text-[var(--color-text-muted)]">{admin.login}</p>
            </div>
            <span className="shrink-0 text-right text-[12px] text-[var(--color-text-muted)]">
              {!admin.isActive ? "bloklangan" : admin.lastLoginAt ? formatDayMonth(admin.lastLoginAt) : "kirmagan"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Operatorning ichki izohi — bog'chaga ko'rinmaydi. */
export function NotesCard({ organization }: { organization: Organization }) {
  const invalidate = useInvalidateOrganization(organization.id);
  const [text, setText] = useState(organization.notes ?? "");
  useEffect(() => setText(organization.notes ?? ""), [organization.notes]);
  const dirty = text.trim() !== (organization.notes ?? "").trim();

  const mutation = useMutation({
    mutationFn: () => api.patch(`/platform/organizations/${organization.id}`, { notes: text.trim() || null }),
    onSuccess: invalidate,
  });

  return (
    <section className="rounded-[var(--radius-xl)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-[17px] font-medium text-[var(--color-text)]">Izoh</h2>
      <p className="text-[12.5px] text-[var(--color-text-muted)]">Faqat platforma jamoasiga ko&apos;rinadi</p>
      <Textarea
        className="mt-3 min-h-[96px]"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={2000}
        placeholder="Masalan: shartnoma 2027-yil yanvargacha, to'lov har oy 5-sanada"
      />
      {mutation.error && (
        <p className="mt-2 text-[12.5px] text-[var(--color-danger)]">
          {mutation.error instanceof ApiError ? mutation.error.message : "Saqlab bo'lmadi"}
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Button size="sm" disabled={!dirty} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Saqlash
        </Button>
      </div>
    </section>
  );
}

/**
 * "Bog'chaga kirish": yangi tab bosish paytida (sinxron) ochiladi — so'rovdan
 * keyin ochilsa brauzer uni popup deb bloklaydi. Chipta kelgach manzil beriladi.
 */
export function useEnterOrganization() {
  const mutation = useMutation({
    mutationFn: async ({ id, tab }: { id: string; tab: Window | null }) => {
      const { ticket, slug } = await api.post<{ ticket: string; slug: string }>(`/platform/organizations/${id}/enter`);
      return { tab, url: `${organizationAccessUrl(slug)}/enter#t=${encodeURIComponent(ticket)}` };
    },
    onSuccess: ({ tab, url }) => {
      if (tab && !tab.closed) tab.location.href = url;
      else window.location.href = url;
    },
    onError: (_err, { tab }) => tab?.close(),
  });
  const enter = (id: string) => {
    const tab = window.open("about:blank", "_blank");
    // Yangi tab platforma oynasini boshqara olmasin
    if (tab) tab.opener = null;
    mutation.mutate({ id, tab });
  };
  return { enter, mutation };
}

// ─── Holat amallari ─────────────────────────────────────────────────────────

export function SuspendModal({ organization, open, onClose }: { organization: Organization; open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateOrganization(organization.id);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.post(`/platform/organizations/${organization.id}/suspend`, { reason: reason.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      setReason("");
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={() => !mutation.isPending && onClose()} title="Bog'chani to'xtatish">
      <div className="space-y-4">
        <p className="text-[14px] text-[var(--color-text-muted)]">
          <b className="text-[var(--color-text)]">{organization.name}</b> paneli va ota-ona kabineti darhol yopiladi, ochiq seanslar
          ham to&apos;xtaydi. Ma&apos;lumotlar saqlanadi — istalgan vaqtda faollashtirasiz.
        </p>
        <Textarea
          label="Sabab (bog'cha xodimlariga ko'rinadi)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          placeholder="Masalan: obuna to'lovi kechikdi"
        />
        {mutation.error && (
          <p className="text-[13px] text-[var(--color-danger)]">
            {mutation.error instanceof ApiError ? mutation.error.message : "Kutilmagan xatolik"}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            To&apos;xtatish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ArchiveModal({ organization, open, onClose }: { organization: Organization; open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateOrganization(organization.id);
  const [confirm, setConfirm] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.post(`/platform/organizations/${organization.id}/archive`, { confirmSlug: confirm.trim() }),
    onSuccess: () => {
      invalidate();
      setConfirm("");
      onClose();
    },
  });
  const matches = confirm.trim().toLowerCase() === organization.slug;
  return (
    <Modal open={open} onClose={() => !mutation.isPending && onClose()} title="Arxivga olish">
      <div className="space-y-4">
        <p className="text-[14px] text-[var(--color-text-muted)]">
          Bog&apos;cha paneli va ota-ona kabineti yopiladi, ro&apos;yxatlarda faqat &quot;Arxiv&quot; filtrida ko&apos;rinadi.
          Ma&apos;lumotlar o&apos;chirilmaydi — arxivdan qaytarish mumkin. Butunlay o&apos;chirish faqat arxivdan keyin ochiladi.
        </p>
        <Input
          label={`Tasdiqlash uchun manzilni yozing: ${organization.slug}`}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder={organization.slug}
          autoComplete="off"
        />
        {mutation.error && (
          <p className="text-[13px] text-[var(--color-danger)]">
            {mutation.error instanceof ApiError ? mutation.error.message : "Kutilmagan xatolik"}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button variant="danger" disabled={!matches} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Arxivga olish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
