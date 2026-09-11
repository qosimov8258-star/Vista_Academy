"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ChildAllergy, DailyReportDay, EatingQuality, MoodStatus, Organization } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { useBranchContext } from "@/lib/use-branch-context";
import { EditDailyReportModal } from "@/features/daily-reports/edit-daily-report-modal";
import { canWriteTeaching } from "@/lib/permissions";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function todayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIMEZONE }).format(new Date());
}

const EATING_LABEL: Record<string, string> = { GOOD: "Yaxshi", AVERAGE: "O'rtacha", POOR: "Yomon" };
const MOOD_LABEL: Record<string, string> = { HAPPY: "Xursand", NEUTRAL: "Oddiy", UPSET: "Xafa" };

export default function DailyReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [branchId, setBranchId] = useState("");
  // "Today" depends on the viewer's clock, which can differ between the
  // server-rendered pass and the client hydration pass — computing it lazily
  // in an effect (client-only) avoids a hydration mismatch on the date input.
  const [date, setDate] = useState("");
  const [editChild, setEditChild] = useState<{ childId: string; fullName: string } | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);

  useEffect(() => {
    setDate((current) => current || todayDateString());
  }, []);

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const branches = orgQuery.data?.branches ?? [];

  useEffect(() => {
    if (forcedBranchId) {
      setBranchId(forcedBranchId);
      return;
    }
    if (!branchId && branches.length > 0) {
      setBranchId(branches[0].id);
    }
  }, [forcedBranchId, branchId, branches]);

  const reportsQuery = useQuery({
    queryKey: ["daily-reports", slug, branchId, date],
    queryFn: () => api.get<DailyReportDay>(`/app/daily-reports?branchId=${branchId}&date=${date}`),
    enabled: !!branchId && !!date,
  });

  // Tarbiyachi ro'yxatni ko'rib chiqayotganda (hali hech kimni ochmasdan)
  // allergiyasi bor bolani darhol ko'rishi kerak — ovqatlanish bilan
  // bog'liq bo'lgani uchun bu yerda ham muhim.
  const allergiesQuery = useQuery({
    queryKey: ["child-allergies", slug, branchId],
    queryFn: () => api.get<ChildAllergy[]>(`/app/health/allergies?branchId=${branchId}`),
    enabled: !!branchId,
  });
  const allergyByChildId = new Map((allergiesQuery.data ?? []).map((a) => [a.child.id, a.allergies]));

  // Tez to'ldirish: sahifa ochilganda har bir bola "Yaxshi ovqatlandi" /
  // "Xursand" deb belgilanadi (hali saqlanmagan) — Davomat sahifasidagi
  // "hammasi Keldi" naqshi bilan bir xil. Tarbiyachi faqat istisnolarni
  // o'zgartiradi va bitta "Hammasini saqlash" bosadi. Uyqu/tualet/faoliyat
  // kabi tafsilotlar bu yerda tegilmaydi — ular alohida modalda saqlanadi
  // va bu yerdan yuborilmagani uchun ular o'zgarishsiz qoladi.
  const [localEating, setLocalEating] = useState<Record<string, EatingQuality>>({});
  const [localMood, setLocalMood] = useState<Record<string, MoodStatus>>({});
  // Faqat filial+sana haqiqatan almashganda tozalanadi — bittagina bolaning
  // "Tafsilotlar" oynasidan saqlashi ham shu so'rovni qayta yuklaydi
  // (invalidateQueries bir xil kalit bilan), aks holda o'sha fon-yangilanish
  // hali saqlanmagan boshqa bolalarning tanlovlarini jimgina o'chirib yuborardi.
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!reportsQuery.data || reportsQuery.data.date !== date) return;
    const key = `${branchId}_${date}`;
    if (initializedForRef.current === key) return;
    initializedForRef.current = key;
    setLocalEating(
      Object.fromEntries(reportsQuery.data.children.map((c) => [c.childId, c.report?.eatingQuality ?? "GOOD"])),
    );
    setLocalMood(
      Object.fromEntries(reportsQuery.data.children.map((c) => [c.childId, c.report?.mood ?? "HAPPY"])),
    );
  }, [reportsQuery.data, date, branchId]);

  const bulkSaveMutation = useMutation({
    mutationFn: async () => {
      if (!reportsQuery.data) return;
      await Promise.all(
        reportsQuery.data.children.map((c) =>
          api.post("/app/daily-reports", {
            childId: c.childId,
            date,
            eatingQuality: localEating[c.childId] ?? "GOOD",
            mood: localMood[c.childId] ?? "HAPPY",
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-reports", slug, branchId, date] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
    },
  });

  // Sana yoki filial almashtirilganda oldingi urinishning xabari yangi
  // kunga osilib qolmasin.
  useEffect(() => {
    bulkSaveMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, branchId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Kundalik hisobot</h1>
        <p className="text-[14px] text-[var(--color-text-muted)]">Har bir bola uchun ovqatlanish, uyqu, kayfiyat va faoliyat</p>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        {!forcedBranchId && (
          <Select label="Filial" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="sm:max-w-xs">
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        )}
        <div className="block">
          <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">Sana</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] outline-none transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/[0.12] sm:w-auto"
          />
        </div>
      </Card>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {!date ? (
        <LoadingState />
      ) : !branchId ? (
        <EmptyState title="Filial mavjud emas" />
      ) : reportsQuery.isLoading ? (
        <LoadingState />
      ) : reportsQuery.isError ? (
        <ErrorState message={(reportsQuery.error as Error).message} />
      ) : !reportsQuery.data || reportsQuery.data.children.length === 0 ? (
        <EmptyState title="Bu filialda faol bola yo'q" />
      ) : (
        <Card className="overflow-hidden">
          <div className="hairline flex items-center justify-between border-b border-[var(--color-separator)] px-5 py-3 text-[12.5px] text-[var(--color-text-muted)] sm:px-6">
            <span className="tabular-nums">
              {reportsQuery.data.children.filter((c) => c.report).length} / {reportsQuery.data.children.length} to&apos;ldirildi
            </span>
          </div>
          <ul className="divide-y divide-[var(--color-separator)]">
            {reportsQuery.data.children.map((c) => (
              <li key={c.childId} className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3">
                <div className="min-w-0">
                  <Link href={`/${slug}/children/${c.childId}`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
                    {c.fullName}
                  </Link>
                  {allergyByChildId.has(c.childId) && (
                    <Badge tone="danger" className="ml-2">
                      Allergiya: {allergyByChildId.get(c.childId)}
                    </Badge>
                  )}
                  {/* Bir necha guruhli tarbiyachi uchun guruh nomi */}
                  {c.groupName && <p className="text-xs text-[var(--color-text-muted)]">{c.groupName}</p>}
                  {c.report && (
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {c.report.sleepMinutes != null && `Uyqu: ${c.report.sleepMinutes} daq`}
                      {c.report.toiletNotes && ` • Tualet: ${c.report.toiletNotes}`}
                      {c.report.activityNotes && ` • Faoliyat: ${c.report.activityNotes}`}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canWrite ? (
                    <>
                      <Select
                        aria-label="Ovqatlanishi"
                        value={localEating[c.childId] ?? "GOOD"}
                        onChange={(e) =>
                          setLocalEating((s) => ({ ...s, [c.childId]: e.target.value as EatingQuality }))
                        }
                        className="h-9 w-32 py-0 text-[13px]"
                      >
                        <option value="GOOD">{EATING_LABEL.GOOD}</option>
                        <option value="AVERAGE">{EATING_LABEL.AVERAGE}</option>
                        <option value="POOR">{EATING_LABEL.POOR}</option>
                      </Select>
                      <Select
                        aria-label="Kayfiyati"
                        value={localMood[c.childId] ?? "HAPPY"}
                        onChange={(e) => setLocalMood((s) => ({ ...s, [c.childId]: e.target.value as MoodStatus }))}
                        className="h-9 w-28 py-0 text-[13px]"
                      >
                        <option value="HAPPY">{MOOD_LABEL.HAPPY}</option>
                        <option value="NEUTRAL">{MOOD_LABEL.NEUTRAL}</option>
                        <option value="UPSET">{MOOD_LABEL.UPSET}</option>
                      </Select>
                    </>
                  ) : (
                    <Badge tone={c.report ? "success" : "neutral"}>{c.report ? "To'ldirilgan" : "To'ldirilmagan"}</Badge>
                  )}
                  {canWrite && (
                    <Button size="sm" variant="outline" onClick={() => setEditChild({ childId: c.childId, fullName: c.fullName })}>
                      Tafsilotlar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {canWrite && (
            <div className="hairline flex items-center justify-between gap-3 border-t border-[var(--color-separator)] px-5 py-3.5 sm:px-6">
              {bulkSaveMutation.isError && (
                <span className="text-[13px] text-[var(--color-danger)]">Saqlashda xatolik yuz berdi</span>
              )}
              {bulkSaveMutation.isSuccess && !bulkSaveMutation.isPending && (
                <span className="text-[13px] text-[var(--color-success)]">Saqlandi</span>
              )}
              <Button className="ml-auto" loading={bulkSaveMutation.isPending} onClick={() => bulkSaveMutation.mutate()}>
                Hammasini saqlash
              </Button>
            </div>
          )}
        </Card>
      )}

      {canWrite && editChild && date && (
        <EditDailyReportModal
          open={!!editChild}
          onClose={() => setEditChild(null)}
          slug={slug}
          branchId={branchId}
          date={date}
          childId={editChild.childId}
          childName={editChild.fullName}
          report={reportsQuery.data?.children.find((c) => c.childId === editChild.childId)?.report ?? null}
        />
      )}
    </div>
  );
}
