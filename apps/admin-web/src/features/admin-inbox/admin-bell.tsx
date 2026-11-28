"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
// Matnlar ro'yxatda tr() bilan tarjima qilinadi: "Kelmaslik sababi: {0}",
// "Farzandi: {0}", "{0} ta bola", "{0} ta bola · {1}", "Eslatma: {0} · {1}",
// "Yo'lga chiqdi — {0} daqiqada keladi · {1}" — lug'atdagi andozalar orqali.
import { useRouter } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Bell, Car, ClipboardX, MessageCircleMore, ReceiptText, Syringe, UserPlus, type LucideIcon } from "lucide-react";
import { api, getPaginated } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { AttendanceDay, DashboardSummary, Lead, Organization, ReviewReceiptItem } from "@/lib/types";
import { useAuth, useFeatureEnabled } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { todayTashkent } from "@/features/desk/shared";
import { IosIcon, type IosTint } from "@/features/director/ios-icon";
import { IosSheet } from "@/components/ios/sheet";
import { Group, Row } from "@/components/ios/group";
import { EmptyState, SkeletonRows } from "@/components/ios/states";
import { useTr } from "@/i18n/tr";

/**
 * Admin (Super Admin, filial admini) uchun yuqori o'ng burchakdagi
 * qo'ng'iroqcha. To'rt manbadan yig'iladi:
 *  - ota-onadan: eslatma va «yo'lga chiqdim» (so'nggi 48 soat), kelmagan kun
 *    uchun yozilgan sabab (bugun);
 *  - tekshirilishi kutilayotgan to'lov cheklari;
 *  - sayt orqali kelgan yangi arizalar (CRM, «Yangi» bosqichida);
 *  - e'tibor talab qiladi: belgilanmagan davomat, to'ldirilmagan kundalik
 *    hisobot, emlash muddati o'tgan bolalar.
 * Har yozuvning barqaror kaliti bor; oyna ochilganda ko'rinayotganlari
 * «ko'rildi» deb shu brauzerda saqlanadi. Ko'rilmagan yozuv bo'lsa —
 * qo'ng'iroqchada qizil nuqta. Platformada o'chirilgan funksiyaga so'rov
 * yuborilmaydi.
 */

type Section = "parent" | "receipt" | "lead" | "attention";

/** `GET /app/employee-notifications/parent-messages` — ota-onaning eslatmasi yoki «yo'lga chiqdim» */
interface ParentMessageItem {
  id: string;
  kind: "NOTE" | "DEPARTURE";
  branchId: string;
  childId: string | null;
  childName: string;
  parentName: string;
  text: string | null;
  minutes: number | null;
  createdAt: string;
}

/** Toshkent vaqti bilan soat:daqiqa */
function clockTashkent(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

interface InboxItem {
  key: string;
  section: Section;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  tint: IosTint;
}

const SECTION_TITLE: Record<Section, string> = {
  parent: "Ota-onadan",
  receipt: "To'lov cheklari",
  lead: "Yangi arizalar",
  attention: "E'tibor talab qiladi",
};
const SECTION_ORDER: Section[] = ["parent", "receipt", "lead", "attention"];
const REFRESH = 60_000;
/** Saqlanadigan «ko'rildi» kalitlari — eskilari tushib ketadi */
const SEEN_LIMIT = 400;

function seenStorageKey(userId: string) {
  return `admin_inbox_seen_v1:${userId}`;
}

function readSeen(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(seenStorageKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(userId: string, keys: string[]) {
  try {
    window.localStorage.setItem(seenStorageKey(userId), JSON.stringify(keys.slice(-SEEN_LIMIT)));
  } catch {
    // Saqlab bo'lmasa (yashirin oyna va h.k.) — nuqta keyingi safar yana chiqadi, xolos
  }
}

/** Qaysi rollarda qo'ng'iroqcha bor */
export function isInboxAdmin(role: string | undefined): boolean {
  return role === "NETWORK_ADMIN" || role === "BRANCH_ADMIN";
}

function useAdminInbox(slug: string) {
  const { user } = useAuth();
  const isOn = useFeatureEnabled();
  const enabled = isInboxAdmin(user?.role);
  const networkAdmin = user?.role === "NETWORK_ADMIN";
  const { branchId: contextBranchId } = useBranchContext(slug);
  const today = todayTashkent();

  // use-branch-context bilan bir xil kalit — so'rov qayta yuborilmaydi
  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
    enabled,
  });
  const allBranches = orgQuery.data?.branches ?? [];
  // Filial admini — o'z filiali; Super Admin — filial ichida o'sha filial, aks holda hammasi
  const branches = networkAdmin
    ? contextBranchId
      ? allBranches.filter((b) => b.id === contextBranchId)
      : allBranches
    : allBranches.filter((b) => b.id === user?.branchId);
  const branchPath = useCallback((branchId: string) => {
    const branch = allBranches.find((b) => b.id === branchId);
    return branch ? `/${slug}/${branch.slug}` : `/${slug}`;
  }, [allBranches, slug]);

  const attendanceOn = enabled && isOn("attendance");
  const attendance = useQueries({
    queries: branches.map((branch) => ({
      queryKey: ["admin-inbox-attendance", slug, branch.id, today],
      queryFn: () => api.get<AttendanceDay>(`/app/attendance?branchId=${branch.id}&date=${today}`),
      enabled: attendanceOn,
      refetchInterval: REFRESH,
    })),
  });

  // Bosh sahifa bilan bir xil kalitlar — tayyor ma'lumot qayta yuklanmaydi
  const summaries = useQueries({
    queries: branches.map((branch) => ({
      queryKey: networkAdmin ? ["dashboard-summary", slug, branch.id] : ["dashboard-summary", slug],
      queryFn: () => api.get<DashboardSummary>(networkAdmin ? `/app/dashboard/summary?branchId=${branch.id}` : "/app/dashboard/summary"),
      enabled,
      refetchInterval: REFRESH,
    })),
  });

  const receiptsOn = enabled && isOn("paymentReceipts");
  const receipts = useQuery({
    queryKey: ["admin-inbox-receipts", slug],
    queryFn: () => api.get<{ items: ReviewReceiptItem[]; pendingCount: number }>("/app/payment-receipts"),
    enabled: receiptsOn,
    refetchInterval: REFRESH,
  });

  // Ota-onaning eslatma va «yo'lga chiqdim» xabarlari (so'nggi 48 soat) — xodim
  // bildirishnomalari yoqilgan bo'lsagina yoziladi
  const parentMessagesOn = enabled && isOn("employeeNotifications");
  const messagesBranch = networkAdmin ? contextBranchId : null;
  const parentMessages = useQuery({
    queryKey: ["admin-inbox-parent-messages", slug, messagesBranch],
    queryFn: () =>
      api.get<ParentMessageItem[]>(`/app/employee-notifications/parent-messages${messagesBranch ? `?branchId=${messagesBranch}` : ""}`),
    enabled: parentMessagesOn,
    refetchInterval: REFRESH,
  });

  const leadsOn = enabled && isOn("crm");
  const leadBranch = networkAdmin ? contextBranchId : null;
  const leads = useQuery({
    queryKey: ["admin-inbox-leads", slug, leadBranch],
    queryFn: () => getPaginated<Lead>(`/app/leads?page=1&limit=50&source=WEBSITE${leadBranch ? `&branchId=${leadBranch}` : ""}`),
    enabled: leadsOn,
    refetchInterval: REFRESH,
  });

  const items = useMemo<InboxItem[]>(() => {
    const out: InboxItem[] = [];
    const multi = branches.length > 1;

    // Avval eng yangisi — ota-ona hozirgina yozgan eslatma yoki yo'lga chiqqani
    for (const message of parentMessages.data ?? []) {
      const time = clockTashkent(message.createdAt);
      const base = branchPath(message.branchId);
      out.push({
        key: `pmsg:${message.id}`,
        section: "parent",
        title: message.childName,
        subtitle:
          message.kind === "DEPARTURE"
            ? `Yo'lga chiqdi — ${message.minutes} daqiqada keladi · ${time}`
            : `Eslatma: ${message.text ?? ""} · ${time}`,
        href: message.childId ? `${base}/children/${message.childId}` : `${base}/attendance`,
        icon: message.kind === "DEPARTURE" ? Car : MessageCircleMore,
        tint: message.kind === "DEPARTURE" ? "teal" : "blue",
      });
    }

    branches.forEach((branch, i) => {
      const day = attendance[i]?.data;
      for (const child of day?.children ?? []) {
        if (!child.parentReason) continue;
        out.push({
          key: `reason:${child.childId}:${today}`,
          section: "parent",
          title: child.fullName,
          subtitle: `Kelmaslik sababi: ${child.parentReason}`,
          href: `${branchPath(branch.id)}/attendance`,
          icon: MessageCircleMore,
          tint: "blue",
        });
      }
    });

    for (const receipt of receipts.data?.items ?? []) {
      if (receipt.status !== "PENDING") continue;
      out.push({
        key: `receipt:${receipt.id}`,
        section: "receipt",
        title: receipt.child.fullName,
        subtitle: `${receipt.guardian.fullName} · ${formatMoney(receipt.claimedAmount)}`,
        href: `/${slug}/payment-receipts`,
        icon: ReceiptText,
        tint: "green",
      });
    }

    for (const lead of leads.data?.data ?? []) {
      if (lead.stage !== "NEW") continue;
      out.push({
        key: `lead:${lead.id}`,
        section: "lead",
        title: lead.parentName,
        subtitle: `Farzandi: ${lead.childFullName}`,
        href: `${branchPath(lead.branchId)}/crm/${lead.id}`,
        icon: UserPlus,
        tint: "orange",
      });
    }

    branches.forEach((branch, i) => {
      const attention = summaries[i]?.data?.attention;
      if (!attention) return;
      const where = multi ? ` · ${branch.name}` : "";
      const base = branchPath(branch.id);
      if (attention.unmarkedAttendance.length > 0) {
        out.push({
          key: `attention:attendance:${branch.id}:${today}`,
          section: "attention",
          title: "Davomat belgilanmagan",
          subtitle: `${attention.unmarkedAttendance.length} ta bola${where}`,
          href: `${base}/attendance`,
          icon: ClipboardX,
          tint: "red",
        });
      }
      if (attention.missingDailyReport.length > 0) {
        out.push({
          key: `attention:reports:${branch.id}:${today}`,
          section: "attention",
          title: "Kundalik hisobot to'ldirilmagan",
          subtitle: `${attention.missingDailyReport.length} ta bola${where}`,
          href: `${base}/daily-reports`,
          icon: ClipboardX,
          tint: "orange",
        });
      }
      if (attention.overdueVaccinations.length > 0) {
        out.push({
          key: `attention:vaccines:${branch.id}:${today}`,
          section: "attention",
          title: "Emlash muddati o'tgan",
          subtitle: `${attention.overdueVaccinations.length} ta bola${where}`,
          href: `${base}/children`,
          icon: Syringe,
          tint: "pink",
        });
      }
    });
    return out;
  }, [branches, attendance, summaries, parentMessages.data, receipts.data, leads.data, today, slug, branchPath]);

  const loading =
    orgQuery.isLoading ||
    (parentMessagesOn && parentMessages.isLoading) ||
    attendance.some((q) => q.isLoading) ||
    summaries.some((q) => q.isLoading) ||
    (receiptsOn && receipts.isLoading) ||
    (leadsOn && leads.isLoading);

  return { enabled, userId: user?.id ?? null, items, loading };
}

export function AdminBell({ slug }: { slug: string }) {
  const tr = useTr();
  const router = useRouter();
  const { enabled, userId, items, loading } = useAdminInbox(slug);
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [open, setOpen] = useState(false);
  // Oyna ochilgan paytdagi yangi yozuvlar — ro'yxatda ko'k nuqta bilan ajraladi
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId) setSeen(readSeen(userId));
  }, [userId]);

  const unseen = seen ? items.filter((item) => !seen.has(item.key)) : [];
  const hasNew = unseen.length > 0;
  // Ro'yxat tarkibi — faqat u o'zgarganda «ko'rildi» qayta yoziladi
  const keysSignature = items.map((item) => item.key).join("\n");

  // Oyna ochilganda (va ochiq turganda kelgan) yozuvlar ko'rilgan hisoblanadi
  useEffect(() => {
    if (!open || !userId) return;
    const keys = keysSignature ? keysSignature.split("\n") : [];
    setSeen((prev) => {
      if (prev && keys.every((key) => prev.has(key))) return prev;
      const next = new Set(prev ?? []);
      for (const key of keys) next.add(key);
      writeSeen(userId, [...next]);
      return next;
    });
  }, [open, keysSignature, userId]);

  if (!enabled) return null;

  const openSheet = () => {
    setFresh(new Set(unseen.map((item) => item.key)));
    setOpen(true);
  };
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const sections = SECTION_ORDER.map((section) => ({ section, rows: items.filter((item) => item.section === section) })).filter((s) => s.rows.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={hasNew ? tr("Bildirishnomalar — yangi xabar bor") : tr("Bildirishnomalar")}
        className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text)] transition-colors hover:bg-black/[0.05] active:bg-black/[0.08]"
      >
        <Bell className="h-[21px] w-[21px]" strokeWidth={2} aria-hidden="true" />
        {hasNew && (
          <span className="absolute right-[7px] top-[6px] h-[9px] w-[9px] rounded-full bg-[#ff3b30] ring-2 ring-white" aria-hidden="true" />
        )}
      </button>

      <IosSheet open={open} onClose={() => setOpen(false)} title={tr("Bildirishnomalar")}>
        {loading && items.length === 0 ? (
          <SkeletonRows rows={3} />
        ) : sections.length === 0 ? (
          <EmptyState icon={Bell} title="Yangi xabar yo'q" hint="Ota-onadan xabar, yangi chek yoki ariza kelsa shu yerda chiqadi" />
        ) : (
          <div className="space-y-5">
            {sections.map(({ section, rows }) => (
              <Group key={section} title={tr(SECTION_TITLE[section])}>
                {rows.map((item) => (
                  <Row
                    key={item.key}
                    onClick={() => go(item.href)}
                    leading={<IosIcon icon={item.icon} tint={item.tint} size={30} />}
                    title={tr(item.title)}
                    subtitle={tr(item.subtitle)}
                    value={
                      fresh.has(item.key) ? (
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#007aff]" aria-label={tr("Yangi")} />
                      ) : undefined
                    }
                  />
                ))}
              </Group>
            ))}
          </div>
        )}
      </IosSheet>
    </>
  );
}
