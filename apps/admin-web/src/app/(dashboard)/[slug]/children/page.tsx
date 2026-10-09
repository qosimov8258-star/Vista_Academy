"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { api, getPaginated } from "@/lib/api";
import type { Child, ChildAllergy, Group } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { ChildIcon, DocumentIcon, PhoneIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";
import { rowLinkProps } from "@/components/ui/table";
import { LoadingState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { Toast, type ToastState } from "@/components/ui/toast";
import { IosButton } from "@/components/ios/button";
import { ChipRow, IosChip, IosSelect, SearchPill } from "@/components/ios/filters";
import { Group as IosGroup, ListRow, Row } from "@/components/ios/group";
import { PageHeaderCard } from "@/components/ios/page-card";
import { Pill } from "@/components/ios/pill";
import { PullToRefresh } from "@/components/ios/pull-to-refresh";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { StatCell, StatStrip } from "@/components/ios/stat-strip";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS, ROW_PRESS } from "@/components/ios/tokens";
import { formatAge, formatChildId, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/download";
import { useBranchContext } from "@/lib/use-branch-context";
import { CreateChildModal } from "@/features/children/create-child-modal";
import { EditChildModal } from "@/features/children/edit-child-modal";
import { TeacherChildren } from "@/features/teacher/teacher-children";
import { canWriteOperational, isTeacher } from "@/lib/permissions";
import { useTr } from "@/i18n/tr";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Faol", INACTIVE: "Nofaol", QUARANTINED: "Karantinda" };
const STATUS_COLOR: Record<string, string> = { ACTIVE: IOS.green, INACTIVE: IOS.gray, QUARANTINED: IOS.red };
const RELATION_LABEL: Record<string, string> = {
  MOTHER: "Onasi",
  FATHER: "Otasi",
  GRANDPARENT: "Buvi/bobo",
  OTHER: "Vasiy",
};

/** Bir martada yuklanadigan bolalar; qolgani "Yana ko'rsatish" bilan */
const LIMIT = 20;

type ChildrenFinanceStats = { paid: number; partial: number; unpaid: number; stopped: number };

/** Tarbiyachi telefon uchun qilingan o'z ro'yxatini oladi, qolgan rollar — umumiy ro'yxatni. */
export default function ChildrenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingState rows={6} />;
  if (isTeacher(user?.role)) return <TeacherChildren slug={slug} />;
  return <BranchChildren slug={slug} />;
}

/** Qidiruv yozilgan sari emas, to'xtaganda so'raladi — har harfga so'rov ketmasin */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Bolalar ro'yxati — iOS grouped uslubida.
 *
 * Funksiyalar (avvalgilarning hammasi saqlangan):
 * - qidiruv (ism, ota-ona, ID), guruh filtri, holat filtri (moliyachida —
 *   to'lov holati); filtr chiplarida soni;
 * - allergiyasi bor bola belgisi; ota-onaga qo'ng'iroq (qatorning o'zida);
 * - moliyachi: bola bosilsa moliya sahifasiga, tepada to'lov statistikasi;
 *   yozish huquqi yo'q rollar uchun "faqat ko'rish" eslatmasi;
 * - CSV eksport, yangi bola qo'shish va tahrirlash (canWrite);
 * - ro'yxat sahifalab ("Yana ko'rsatish"), yangilash va pastga tortish.
 * Telefonda qator bosilsa tafsilot varag'i ochiladi; katta ekranda (xl)
 * jadval, qator bosilsa — bola profili.
 */
function BranchChildren({ slug }: { slug: string }) {
  const tr = useTr();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 300);
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [openChild, setOpenChild] = useState<Child | null>(null);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  // Tarbiyachiga bitta guruh biriktiriladi — guruh filtri, guruh va filial ustuni unga keraksiz.
  const teacher = isTeacher(user?.role);
  const { branchId: forcedBranchId, branchSlug, base } = useBranchContext(slug);
  // Moliyachi shu ro'yxatdan o'quvchini bosganda to'liq profilga emas, faqat
  // to'lovlar va moliyaviy tarix ko'rinadigan alohida sahifaga o'tadi —
  // rivojlanish, sog'liq va shu kabi bo'limlar moliyachiga aloqasi yo'q.
  const isFinance = user?.role === "FINANCE";
  const childHref = (childId: string) =>
    isFinance ? (branchSlug ? `/${slug}/${branchSlug}/finance/${childId}` : `/${slug}/finance/${childId}`) : `${base}/children/${childId}`;

  const branchParam = forcedBranchId ? `&branchId=${forcedBranchId}` : "";
  const statusParam = (value: string) => (value ? (isFinance ? `&paymentStatus=${value}` : `&status=${value}`) : "");
  const baseFilters = branchParam + (search ? `&search=${encodeURIComponent(search)}` : "") + (groupFilter ? `&groupId=${groupFilter}` : "");

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });

  // Ro'yxatni skanerlayotgan xodim allergiyasi bor bolani bir qarashda
  // ko'rsin — har bir qatorni ochib ko'rishning hojati qolmaydi.
  const allergiesQuery = useQuery({
    queryKey: ["child-allergies", slug, forcedBranchId],
    queryFn: () => api.get<ChildAllergy[]>(`/app/health/allergies${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const allergyChildIds = new Set((allergiesQuery.data ?? []).map((a) => a.child.id));

  // Moliyachi yozish huquqiga ega emas — "faqat ko'rish" ogohlantirishi
  // o'rniga unga foydali bo'lgan to'lov statistikasi ko'rsatiladi.
  const financeStatsQuery = useQuery({
    queryKey: ["children-finance-stats", slug, forcedBranchId],
    queryFn: () => api.get<ChildrenFinanceStats>(`/app/children/finance-stats${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
    enabled: isFinance,
  });

  const childrenQuery = useInfiniteQuery({
    queryKey: ["children", slug, "list", forcedBranchId, search, groupFilter, statusFilter, isFinance],
    queryFn: ({ pageParam }) => getPaginated<Child>(`/app/children?page=${pageParam}&limit=${LIMIT}${baseFilters}${statusParam(statusFilter)}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.limit < last.meta.total ? last.meta.page + 1 : undefined),
    placeholderData: (prev) => prev,
  });
  const children = childrenQuery.data?.pages.flatMap((p) => p.data) ?? [];
  const total = childrenQuery.data?.pages[0]?.meta.total ?? 0;

  // Filtr chiplaridagi sonlar — qidiruv va guruh filtri hisobga olingan holda
  const chipOptions = isFinance
    ? [
        { value: "", label: "Barchasi" },
        { value: "PAID", label: "To'langan" },
        { value: "PARTIAL", label: "Yarim" },
        { value: "UNPAID", label: "To'lamagan" },
      ]
    : [
        { value: "", label: "Barchasi" },
        { value: "ACTIVE", label: "Faol" },
        { value: "INACTIVE", label: "Nofaol" },
      ];
  const counts = useQueries({
    queries: chipOptions.map((option) => ({
      queryKey: ["children", slug, "count", forcedBranchId, search, groupFilter, option.value, isFinance],
      queryFn: async () => (await getPaginated<Child>(`/app/children?page=1&limit=1${baseFilters}${statusParam(option.value)}`)).meta.total,
      placeholderData: (prev: number | undefined) => prev,
    })),
  });

  const filtersActive = Boolean(searchInput || groupFilter || statusFilter);
  const clearFilters = () => {
    setSearchInput("");
    setGroupFilter("");
    setStatusFilter("");
  };

  const refresh = async () => {
    await Promise.all([childrenQuery.refetch(), allergiesQuery.refetch(), ...(isFinance ? [financeStatsQuery.refetch()] : [])]);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsv(`/app/exports/children${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`, "bolalar.csv");
      setToast({ type: "success", message: tr("bolalar.csv yuklab olindi") });
    } catch {
      setToast({ type: "error", message: tr("Eksport qilib bo'lmadi — qayta urinib ko'ring") });
    } finally {
      setExporting(false);
    }
  };

  const startEdit = (child: Child) => {
    setOpenChild(null);
    setEditingChild(child);
    setEditOpen(true);
  };

  const groupName = (groupFilter && groupsQuery.data?.find((g) => g.id === groupFilter)?.name) || tr("Barcha guruhlar");
  const stats = financeStatsQuery.data;

  return (
    // Telefonda chetlar 16px (asosiy konteyner 24px beradi)
    <div className="-mx-2 md:mx-0">
      <PullToRefresh onRefresh={refresh} />
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-2">
        <PageHeaderCard
          icon={ChildIcon}
          title={tr("Bolalar")}
          count={counts[0]?.data !== undefined && !search && !groupFilter ? tr("{0} ta", counts[0].data) : undefined}
          subtitle={tr("Tarmoqqa ro'yxatga olingan bolalar")}
          actions={
            <>
              <IosButton label={tr("Eksport (CSV)")} icon={DocumentIcon} compact onClick={handleExport} loading={exporting} />
              {canWrite && <IosButton label={tr("Yangi bola")} icon={PlusIcon} variant="primary" compact onClick={() => setCreateOpen(true)} />}
            </>
          }
        />

        {!canWrite &&
          (isFinance ? (
            <StatStrip>
              <StatCell label={tr("To'lagan")} value={stats?.paid ?? "—"} color={IOS.green} loading={financeStatsQuery.isLoading} />
              <StatCell label={tr("Yarim to'lagan")} value={stats?.partial ?? "—"} color={IOS.orange} loading={financeStatsQuery.isLoading} />
              <StatCell label={tr("To'lamagan")} value={stats?.unpaid ?? "—"} color={IOS.red} loading={financeStatsQuery.isLoading} />
              <StatCell label={tr("To'xtatgan")} value={stats?.stopped ?? "—"} color={IOS.gray} loading={financeStatsQuery.isLoading} />
            </StatStrip>
          ) : (
            <ViewOnlyNote role={user?.role} />
          ))}

        {/* Qidiruv va filtrlar */}
        <div className="space-y-3 px-0">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <SearchPill value={searchInput} onChange={setSearchInput} placeholder={tr("Ism, ota-ona yoki ID (id14732)")} className="flex-1" />
            {!teacher && (
              <IosSelect label={tr("Guruh")} value={groupFilter} onChange={setGroupFilter} display={tr(groupName)}>
                <option value="">{tr("Barcha guruhlar")}</option>
                {(groupsQuery.data ?? []).map((group) => (
                  <option key={group.id} value={group.id}>
                    {tr(group.name)}
                  </option>
                ))}
              </IosSelect>
            )}
          </div>
          <ChipRow label={isFinance ? tr("To'lov holati") : tr("Holat")}>
            {chipOptions.map((option, i) => (
              <IosChip key={option.value || "all"} active={statusFilter === option.value} onClick={() => setStatusFilter(option.value)} count={counts[i]?.data}>
                {tr(option.label)}
              </IosChip>
            ))}
          </ChipRow>
        </div>

        <IosGroup
          title={
            <>
              {tr("Ro'yxat")}
              {childrenQuery.data && <span className="font-normal normal-case tracking-normal">· {total}</span>}
            </>
          }
          refreshing={childrenQuery.isFetching && !childrenQuery.isLoading && !childrenQuery.isFetchingNextPage}
          bare
        >
          {childrenQuery.isLoading ? (
            <SkeletonRows rows={7} />
          ) : childrenQuery.isError && children.length === 0 ? (
            <ErrorState message={(childrenQuery.error as Error).message} onRetry={() => childrenQuery.refetch()} retrying={childrenQuery.isFetching} />
          ) : children.length === 0 ? (
            <div className="space-y-3">
              <EmptyState
                icon={search ? SearchIcon : ChildIcon}
                title={filtersActive ? "Bola topilmadi" : "Hali bola yo'q"}
                hint={filtersActive ? "Qidiruv yoki filtr shartini o'zgartiring" : canWrite ? "Yangi bola qo'shish uchun tugmani bosing" : undefined}
              />
              {filtersActive && (
                <div className="flex justify-center">
                  <IosButton label={tr("Filtrni tozalash")} onClick={clearFilters} />
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Telefon, planshet va kichik noutbuk — iOS qatorlari */}
              <div className={`${GROUP_BLOCK} xl:hidden`}>
                {children.map((child) => {
                  const guardian = child.guardians?.[0];
                  return (
                    <ListRow
                      key={child.id}
                      onClick={() => setOpenChild(child)}
                      avatar={<ChildPhoto child={child} size={44} fallback={initials(child.fullName)} />}
                      title={tr(child.fullName)}
                      subtitle={[formatChildId(child.publicId), !teacher && child.group?.name ? tr(child.group.name) : null].filter(Boolean).join(" · ")}
                      meta={<ChildPills child={child} allergy={allergyChildIds.has(child.id)} />}
                      chevron={!guardian}
                      trailing={guardian ? <CallButton phone={guardian.guardian.phone} name={guardian.guardian.fullName} /> : undefined}
                    />
                  );
                })}
              </div>

              {/* Katta ekran (xl) — jadval, qator bosilsa profil */}
              <div className={`${GROUP_BLOCK} hidden overflow-x-auto xl:block`}>
                <table className="w-full text-left text-[14px]">
                  <thead>
                    <tr className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#6d6d72]">
                      <th className="w-px py-3 pl-4 pr-0">
                        <span className="sr-only">{tr("Surat")}</span>
                      </th>
                      <th className="px-4 py-3">{tr("To'liq ism")}</th>
                      <th className="px-4 py-3">{tr("Ota-ona / aloqa")}</th>
                      <th className="px-4 py-3">{tr("Tug'ilgan sana")}</th>
                      {!forcedBranchId && !teacher && <th className="px-4 py-3">{tr("Filial")}</th>}
                      {!teacher && <th className="px-4 py-3">{tr("Guruh")}</th>}
                      <th className="px-4 py-3">{tr("Holat")}</th>
                      {canWrite && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((child) => {
                      const guardian = child.guardians?.[0];
                      return (
                        <tr key={child.id} {...rowLinkProps(childHref(child.id), (href) => router.push(href))} className={`cursor-pointer border-t border-[#c6c6c8]/50 ${ROW_PRESS}`}>
                          <td className="w-px py-2.5 pl-4 pr-0">
                            <ChildPhoto child={child} size={40} fallback={initials(child.fullName)} />
                          </td>
                          <td className="max-w-[260px] px-4 py-2.5">
                            <p className="truncate text-[15px] font-medium text-[var(--color-text)]" title={child.fullName}>
                              {tr(child.fullName)}
                            </p>
                            <p className="font-mono text-[12.5px] tabular-nums text-[#8e8e93]">{formatChildId(child.publicId)}</p>
                          </td>
                          <td className="max-w-[240px] px-4 py-2.5">
                            {guardian ? (
                              <>
                                <p className="truncate text-[var(--color-text)]">{tr(guardian.guardian.fullName)}</p>
                                <p className="truncate text-[12.5px] tabular-nums text-[#8e8e93]">
                                  {tr(RELATION_LABEL[guardian.relation])} · {tr(guardian.guardian.phone)}
                                </p>
                              </>
                            ) : (
                              <span className="text-[#8e8e93]">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-[#8e8e93]">{child.birthDate ? formatDate(child.birthDate) : "—"}</td>
                          {!forcedBranchId && !teacher && <td className="whitespace-nowrap px-4 py-2.5 text-[#8e8e93]">{child.branch?.name ?? "—"}</td>}
                          {!teacher && <td className="whitespace-nowrap px-4 py-2.5 text-[#8e8e93]">{child.group?.name ? tr(child.group.name) : "—"}</td>}
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1.5">
                              <Pill color={STATUS_COLOR[child.status]}>{tr(STATUS_LABEL[child.status])}</Pill>
                              {allergyChildIds.has(child.id) && <Pill color={IOS.red}>{tr("Allergiya")}</Pill>}
                            </div>
                          </td>
                          {canWrite && (
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startEdit(child);
                                }}
                                className="h-8 rounded-full bg-[#767680]/[0.12] px-3.5 text-[13px] font-semibold text-[var(--color-primary)] transition-[transform,background-color] hover:bg-[#767680]/[0.18] active:scale-[0.96]"
                              >
                                {tr("Tahrirlash")}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col items-center gap-2.5 pt-3">
                {childrenQuery.hasNextPage && (
                  <IosButton
                    label={tr("Yana ko'rsatish")}
                    onClick={() => childrenQuery.fetchNextPage()}
                    loading={childrenQuery.isFetchingNextPage}
                  />
                )}
                <p className="text-[12.5px] tabular-nums text-[#8e8e93]">{tr("Jami {0} ta · {1} tasi ko'rsatildi", total, children.length)}</p>
              </div>
            </>
          )}
        </IosGroup>
      </div>

      {/* Bola tafsiloti (telefon) */}
      <IosSheet
        open={openChild !== null}
        onClose={() => setOpenChild(null)}
        cancelLabel="Yopish"
        title={openChild ? tr(openChild.fullName) : ""}
        footer={
          openChild && (
            <>
              <SheetPrimaryButton href={childHref(openChild.id)}>{isFinance ? tr("To'lovlarni ochish") : tr("Profilni ochish")}</SheetPrimaryButton>
              {canWrite && <SheetSecondaryButton onClick={() => startEdit(openChild)}>{tr("Tahrirlash")}</SheetSecondaryButton>}
            </>
          )
        }
      >
        {openChild && (
          <>
            <div className="flex flex-col items-center gap-2 pt-1 text-center">
              <ChildPhoto child={openChild} size={76} fallback={initials(openChild.fullName)} />
              <p className="font-mono text-[13px] tabular-nums text-[#8e8e93]">{formatChildId(openChild.publicId)}</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                <Pill color={STATUS_COLOR[openChild.status]}>{tr(STATUS_LABEL[openChild.status])}</Pill>
                {allergyChildIds.has(openChild.id) && <Pill color={IOS.red}>{tr("Allergiya")}</Pill>}
              </div>
            </div>
            <SheetSection title={tr("Ma'lumot")}>
              {!teacher && <SheetRow label={tr("Guruh")}>{openChild.group?.name ? tr(openChild.group.name) : tr("Guruhsiz")}</SheetRow>}
              {!forcedBranchId && !teacher && <SheetRow label={tr("Filial")}>{openChild.branch?.name ?? "—"}</SheetRow>}
              <SheetRow label={tr("Tug'ilgan sana")}>
                {openChild.birthDate ? `${formatDate(openChild.birthDate)} · ${tr(formatAge(openChild.birthDate))}` : "—"}
              </SheetRow>
            </SheetSection>
            <SheetSection title={tr("Ota-onalar")}>
              {(openChild.guardians ?? []).length === 0 ? (
                <Row title={<span className="text-[#8e8e93]">{tr("Ota-ona biriktirilmagan")}</span>} />
              ) : (
                (openChild.guardians ?? []).map((g) => (
                  <ListRow
                    key={g.guardian.phone + g.relation}
                    title={tr(g.guardian.fullName)}
                    subtitle={`${tr(RELATION_LABEL[g.relation])} · ${tr(g.guardian.phone)}`}
                    trailing={<CallButton phone={g.guardian.phone} name={g.guardian.fullName} />}
                  />
                ))
              )}
            </SheetSection>
          </>
        )}
      </IosSheet>

      {canWrite && <CreateChildModal open={createOpen} onClose={() => setCreateOpen(false)} slug={slug} />}
      {canWrite && editingChild && (
        <EditChildModal
          key={editingChild.id}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => setToast({ type: "success", message: tr("Saqlandi") })}
          slug={slug}
          child={editingChild}
        />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

/** Holat (faoldan boshqasi) va allergiya yorliqlari — faol bola uchun ortiqcha yorliq yo'q */
function ChildPills({ child, allergy }: { child: Child; allergy: boolean }) {
  const tr = useTr();
  if (child.status === "ACTIVE" && !allergy) return null;
  return (
    <span className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
      {child.status !== "ACTIVE" && <Pill color={STATUS_COLOR[child.status]}>{tr(STATUS_LABEL[child.status])}</Pill>}
      {allergy && <Pill color={IOS.red}>{tr("Allergiya")}</Pill>}
    </span>
  );
}

/** Qatordagi asosiy amal — ota-onaga qo'ng'iroq (kichik doira tugma) */
function CallButton({ phone, name }: { phone: string; name: string }) {
  const tr = useTr();
  return (
    <a
      href={`tel:${phone}`}
      onClick={(event) => event.stopPropagation()}
      aria-label={tr("{0} ga qo'ng'iroq: {1}", name, phone)}
      title={phone}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#34c759]/[0.14] text-[#34c759] transition-transform active:scale-90"
    >
      <PhoneIcon className="h-[17px] w-[17px]" strokeWidth={2.2} />
    </a>
  );
}
