"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api, getPaginated } from "@/lib/api";
import type { Child, ChildAllergy, CoinChildBalance } from "@/lib/types";
import { useBranchContext } from "@/lib/use-branch-context";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { ChevronRightIcon, ChildIcon, CloseIcon, PhoneIcon, SearchIcon } from "@/components/ios/icons";
import { ChildPhotoSheet } from "@/features/children/child-photo-sheet";
import { AwardStarsSheet } from "@/features/coins/award-stars-sheet";
import { IOS } from "@/components/ios/tokens";
import { Camera, Paperclip, Star } from "lucide-react";
import { EmptyRow, Group, LargeTitle, Row, Segmented, SkeletonRows, TeacherPage } from "./teacher-ui";
import styles from "./teacher.module.css";
import { useTr } from "@/i18n/tr";

const RELATION_LABEL: Record<string, string> = { MOTHER: "Onasi", FATHER: "Otasi", GRANDPARENT: "Buvi/bobo", OTHER: "Vasiy" };
/** Tarbiyachining guruhi bir sahifaga sig'adi — sahifalash o'rniga bitta ro'yxat */
const LIMIT = 100;

/**
 * Tarbiyachining bolalar ro'yxati — telefon uchun: qidiruv, holat bo'yicha
 * segment va iOS kontaktlaridek ro'yxat. O'ngdagi go'shak belgisi ota-onaga
 * bir bosishda qo'ng'iroq qiladi.
 */
export function TeacherChildren({ slug }: { slug: string }) {
  const tr = useTr();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "INACTIVE">("ACTIVE");
  const [onlyNoPhoto, setOnlyNoPhoto] = useState(false);
  const [photoChild, setPhotoChild] = useState<Child | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [starChild, setStarChild] = useState<Child | null>(null);
  const [starOpen, setStarOpen] = useState(false);

  const childrenQuery = useQuery({
    queryKey: ["children", slug, 1, forcedBranchId, search, "", status, LIMIT],
    queryFn: () =>
      getPaginated<Child>(
        `/app/children?page=1&limit=${LIMIT}` +
          (forcedBranchId ? `&branchId=${forcedBranchId}` : "") +
          (search ? `&search=${encodeURIComponent(search)}` : "") +
          (status ? `&status=${status}` : ""),
      ),
    placeholderData: (prev) => prev,
  });
  const allergiesQuery = useQuery({
    queryKey: ["child-allergies", slug, forcedBranchId],
    queryFn: () => api.get<ChildAllergy[]>(`/app/health/allergies${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const allergyIds = new Set((allergiesQuery.data ?? []).map((a) => a.child.id));
  // Har bir bolaning yulduzcha balansi — ro'yxatdagi ⭐ tugmasida ko'rinadi
  const starsQuery = useQuery({
    queryKey: ["coin-children", slug, forcedBranchId ?? "mine"],
    queryFn: () => api.get<CoinChildBalance[]>(`/app/coins/children${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const starsByChild = new Map((starsQuery.data ?? []).map((row) => [row.childId, row.balance]));

  const all = childrenQuery.data?.data ?? [];
  const noPhotoCount = all.filter((c) => c.status === "ACTIVE" && !c.avatarUpdatedAt).length;
  const list = onlyNoPhoto ? all.filter((c) => !c.avatarUpdatedAt) : all;
  const total = childrenQuery.data?.meta.total ?? 0;
  const groupName = all.find((c) => c.group)?.group?.name;

  return (
    <TeacherPage>
      <LargeTitle
        title={tr("Bolalar")}
        subtitle={childrenQuery.isLoading ? " " : [tr("{0} ta bola", total), groupName].filter(Boolean).join(" · ")}
      />

      {/* Guruh fayllari telefondagi pastki menyuda yo'q — ota-onalarga yuborish shu yerdan ham */}
      <Group>
        <Row first icon={Paperclip} title={tr("Vazifa jo'natish")} subtitle={tr("Vazifa, rasm, video yoki hujjat")} href={`/${slug}/materials`} />
        {(noPhotoCount > 0 || onlyNoPhoto) && (
          <Row
            icon={Camera}
            title={tr("Surati yo'q bolalar")}
            subtitle={onlyNoPhoto ? tr("Hammasini ko'rsatish uchun bosing") : tr("Surat Face ID uchun kerak")}
            value={noPhotoCount}
            onClick={() => setOnlyNoPhoto((on) => !on)}
          />
        )}
      </Group>

      <div className="space-y-3 px-0">
        {/* iOS qidiruv maydoni */}
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("Ism, ota-ona yoki ID")}
            aria-label={tr("Bolalarni qidirish")}
            className="h-10 w-full appearance-none rounded-[11px] bg-[rgba(118,118,128,0.12)] pl-10 pr-10 text-[16px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-primary)]/25 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={tr("Qidiruvni tozalash")}
              className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[var(--color-text-muted)]/60 text-white"
            >
              <CloseIcon className="h-3 w-3" strokeWidth={3} />
            </button>
          )}
        </label>
        <Segmented
          label={tr("Holat")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "ACTIVE", label: "Faol" },
            { value: "INACTIVE", label: "Nofaol" },
            { value: "", label: "Hammasi" },
          ]}
        />
      </div>

      <Group
        footer={total > all.length ? tr("Birinchi {0} ta ko'rsatildi — aniqroq qidiring.", all.length) : undefined}
        className={clsx(childrenQuery.isFetching && !childrenQuery.isLoading && "opacity-70 transition-opacity")}
      >
        {childrenQuery.isLoading ? (
          <SkeletonRows rows={6} />
        ) : childrenQuery.isError ? (
          <EmptyRow title={tr("Yuklab bo'lmadi")} description={tr((childrenQuery.error as Error).message)} />
        ) : list.length === 0 ? (
          <EmptyRow icon={ChildIcon} title={tr("Bola topilmadi")} description={search ? tr("Boshqa so'z bilan qidirib ko'ring") : undefined} />
        ) : (
          list.map((child, i) => {
            const guardian = child.guardians?.[0];
            return (
              <div key={child.id} className="relative flex items-center">
                {i > 0 && <span className="absolute left-[72px] right-0 top-0 h-px bg-[var(--color-separator)]" aria-hidden="true" />}
                <button
                  type="button"
                  onClick={() => {
                    setPhotoChild(child);
                    setPhotoOpen(true);
                  }}
                  aria-label={tr("{0} surati", child.fullName)}
                  className="relative ml-4 shrink-0 cursor-pointer rounded-full transition-transform active:scale-95"
                >
                  <ChildPhoto child={child} size={44} fallback={initials(child.fullName)} />
                  {!child.avatarUpdatedAt && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--color-primary)] text-white ring-2 ring-white">
                      <Camera className="h-2.5 w-2.5" strokeWidth={2.6} />
                    </span>
                  )}
                </button>
                <Link
                  href={`/${slug}/children/${child.id}`}
                  className={clsx(styles.pressable, "flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-2")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[16px] leading-snug text-[var(--color-text)]">{tr(child.fullName)}</span>
                      {allergyIds.has(child.id) && (
                        <span className="shrink-0 rounded-full bg-[var(--color-danger-bg)] px-1.5 py-px text-[11px] font-semibold text-[var(--color-danger)]">{tr("Allergiya")}</span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[13.5px] text-[var(--color-text-muted)]">
                      {guardian ? `${RELATION_LABEL[guardian.relation] ?? ""}: ${guardian.guardian.fullName}` : tr("Ota-ona kiritilmagan")}
                      {child.status !== "ACTIVE" && " · Nofaol"}
                    </span>
                  </span>
                  {!guardian?.guardian.phone && child.status !== "ACTIVE" && <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c4c4c7]" />}
                </Link>
                {child.status === "ACTIVE" && (
                  <button
                    type="button"
                    onClick={() => {
                      setStarChild(child);
                      setStarOpen(true);
                    }}
                    aria-label={tr("{0}ga yulduzcha berish", child.fullName)}
                    className="flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 transition-transform active:scale-95"
                  >
                    <span
                      className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[14px] font-semibold tabular-nums"
                      style={{ backgroundColor: `${IOS.orange}1f`, color: IOS.orange }}
                    >
                      <Star className="h-4 w-4" fill={IOS.orange} strokeWidth={0} />
                      {starsByChild.get(child.id) ?? "·"}
                    </span>
                  </button>
                )}
                {guardian?.guardian.phone && (
                  <a
                    href={`tel:${guardian.guardian.phone.replace(/[^\d+]/g, "")}`}
                    aria-label={tr("{0}ga qo'ng'iroq qilish", guardian.guardian.fullName)}
                    className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--color-primary)] transition-colors active:bg-black/5"
                  >
                    <PhoneIcon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                  </a>
                )}
              </div>
            );
          })
        )}
      </Group>

      {starChild && (
        <AwardStarsSheet
          open={starOpen}
          onClose={() => setStarOpen(false)}
          slug={slug}
          child={starChild}
          balance={starsByChild.get(starChild.id)}
        />
      )}

      {photoChild && (
        <ChildPhotoSheet open={photoOpen} onClose={() => setPhotoOpen(false)} slug={slug} child={photoChild} canRemove={false} />
      )}
    </TeacherPage>
  );
}
