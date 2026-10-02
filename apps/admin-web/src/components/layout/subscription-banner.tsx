"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Muddat tugashiga shuncha kun qolganda ogohlantirish chiqadi. */
const WARN_DAYS = 7;

const money = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
const date = (value: string) => {
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

/**
 * Super Admin'ga platforma obunasi haqida ogohlantirish: sinov tugayapti,
 * muddat yaqin va hamyonda pul yetmaydi, yoki imtiyozli davr (panel tez
 * orada yopiladi). Obuna hamyondan avtomatik yangilanadi — pul yetarli
 * bo'lsa hech narsa ko'rsatilmaydi.
 */
export function SubscriptionBanner({ slug }: { slug: string }) {
  const { user } = useAuth();
  const isOwner = user?.role === "NETWORK_ADMIN" && !user.impersonatedBy;
  const { data: org } = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
    enabled: isOwner,
  });

  const sub = org?.subscription;
  if (!isOwner || !sub) return null;

  const price = Number(sub.plan.priceMonthly);
  const balance = Number(org?.wallet?.balance ?? 0);
  const daysLeft = Math.ceil((new Date(sub.currentPeriodEnd).getTime() - Date.now()) / DAY_MS);
  const shortfall = price - balance;

  let message: string | null = null;
  let tone: "warning" | "danger" = "warning";
  if (sub.status === "GRACE_PERIOD") {
    tone = "danger";
    message = `Obuna muddati tugadi, hamyonda mablag' yetarli emas (kerak: ${money(price)} so'm). Panel ${sub.graceUntil ? date(sub.graceUntil) : "tez orada"} kuni yopiladi — platforma bilan bog'lanib hamyonni to'ldiring.`;
  } else if (org?.billingAutoRenew && sub.status === "ACTIVE" && daysLeft <= WARN_DAYS && shortfall > 0) {
    const what = sub.trialEndsAt ? "Sinov muddati" : "Obuna muddati";
    message = `${what} ${daysLeft <= 1 ? "ertaga" : `${daysLeft} kundan keyin`} tugaydi. Davom etish uchun hamyonga yana ${money(shortfall)} so'm kerak (${sub.plan.name}: ${money(price)} so'm/oy).`;
  }
  if (!message) return null;

  return (
    <div
      role="status"
      className={
        tone === "danger"
          ? "shrink-0 bg-[var(--color-danger-bg)] px-4 py-2 text-center text-[13px] font-medium text-[var(--color-danger)]"
          : "shrink-0 bg-[var(--color-warning-bg)] px-4 py-2 text-center text-[13px] font-medium text-[var(--color-warning)]"
      }
    >
      {message}
    </div>
  );
}
