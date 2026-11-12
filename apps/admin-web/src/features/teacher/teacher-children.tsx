"use client";

import { useState } from "react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { Camera, Paperclip, Star, UserRound } from "lucide-react";
import { api, getPaginated } from "@/lib/api";
import type { Child, ChildAllergy, CoinChildBalance } from "@/lib/types";
import { useBranchContext } from "@/lib/use-branch-context";
import { ChildPhoto } from "@/components/ui/child-photo";
import { initials } from "@/components/ui/avatar";
import { ChildIcon, CloseIcon, PhoneIcon, SearchIcon } from "@/components/ios/icons";
import { IosSheet, SheetSection } from "@/components/ios/sheet";
import { Row as IosRow } from "@/components/ios/group";
import { Pill } from "@/components/ios/pill";
import { IOS } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { ChildPhotoSheet } from "@/features/children/child-photo-sheet";
import { AwardStarsSheet } from "@/features/coins/award-stars-sheet";
import { EmptyRow, Group, LargeTitle, Row, Segmented, SkeletonRows, TeacherPage } from "./teacher-ui";
import styles from "./teacher.module.css";
import { useTr } from "@/i18n/tr";

const RELATION_LABEL: Record<string, string> = { MOTHER: "Onasi", FATHER: "Otasi", GRANDPARENT: "Buvi/bobo", OTHER: "Vasiy" };
/** Tarbiyachining guruhi bir sahifaga sig'adi — sahifalash o'rniga bitta ro'yxat */
const LIMIT = 100;

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/**
 * Tarbiyachining bolalar ro'yxati — telefon birinchi. Qidiruv, holat
 * segmenti, «Surati yo'q» suzgichi. Qatorda: surat, ism, ota-ona, ⭐ balans;
 * o'ngda bitta tugma — ota-onaga qo'ng'iroq. Qator bosilsa pastdan bola
 * varag'i: surat, yulduzcha berish, barcha ota-onalarga qo'ng'iroq, profil.
 */
export function TeacherChildren({ slug }: { slug: string }) {
  const tr = useTr();
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "INACTIVE">("ACTIVE");
  const [onlyNoPhoto, setOnlyNoPhoto] = useState(false);

  // Ochiq varaq: bola varag'i, surat yoki yulduzcha
  const [current, setCurrent] = useState<Child | null>(null);
  const [view, setView] = useState<"child" | "photo" | "star" | null>(null);

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
  // Har bir bolaning yulduzcha balansi — qatorda ⭐ kapsulasida ko'rinadi
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
  // Surat yangilangach ro'yxatdagi eng so'nggi ma'lumot varaqda ham ko'rinsin
  const shown = current ? (all.find((c) => c.id === current.id) ?? current) : null;

  const open = (child: Child, next: "child" | "photo" | "star") => {
    setCurrent(child);
    setView(next);
  };

  return (
    <TeacherPage>
      <LargeTitle
        icon={ChildIcon}
        tint="blue"
        title={tr("Bolalar")}
        subtitle={childrenQuery.isLoading ? " " : [tr("{0} ta bola", total), groupName ? tr(groupName) : null].filter(Boolean).join(" · ")}
      />

      {/* Qidiruv va holat — bosh barmoq yetadigan balandlikda */}
      <div className="space-y-2.5">
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8e8e93]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr("Ism, ota-ona yoki ID")}
            aria-label={tr("Bolalarni qidirish")}
            className="h-11 w-full appearance-none rounded-full bg-[#767680]/[0.12] pl-10 pr-11 text-[16px] text-[var(--color-text)] outline-none placeholder:text-[#8e8e93] focus:ring-2 focus:ring-[var(--color-primary)]/25 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={tr("Qidiruvni tozalash")}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8e8e93]/70 text-white">
                <CloseIcon className="h-3 w-3" strokeWidth={3} />
              </span>
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

      {/* Guruh fayllari telefondagi pastki menyuda yo'q — ota-onalarga yuborish shu yerdan ham */}
      <Group>
        <Row first icon={Paperclip} tint="teal" title={tr("Vazifa jo'natish")} subtitle={tr("Vazifa, rasm, video yoki hujjat")} href={`/${slug}/materials`} />
        {(noPhotoCount > 0 || onlyNoPhoto) && (
          <Row
            icon={Camera}
            tint="orange"
            title={onlyNoPhoto ? tr("Faqat surati yo'qlar ko'rsatilmoqda") : tr("Surati yo'q bolalar")}
            subtitle={onlyNoPhoto ? tr("Hammasini ko'rsatish uchun bosing") : tr("Surat Face ID uchun kerak")}
            value={noPhotoCount}
            onClick={() => setOnlyNoPhoto((on) => !on)}
          />
        )}
      </Group>

      <Group
        title={
          onlyNoPhoto
            ? tr("Surati yo'q")
            : status === "INACTIVE"
              ? tr("Nofaol bolalar")
              : tr("Bolalar")
        }
        action={list.length > 0 ? <span className="tabular-nums text-[#8e8e93]">{list.length}</span> : undefined}
        footer={
          total > all.length
            ? tr("Birinchi {0} ta ko'rsatildi — aniqroq qidiring.", all.length)
            : list.length > 0
              ? tr("Bolani bosing — surat, yulduzcha va ota-ona bir joyda.")
              : undefined
        }
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
            const phone = guardian?.guardian.phone;
            const balance = starsByChild.get(child.id);
            const active = child.status === "ACTIVE";
            return (
              <div key={child.id} className="relative flex items-center">
                {i > 0 && <span className="absolute left-[72px] right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
                <button
                  type="button"
                  onClick={() => open(child, "child")}
                  className={clsx(styles.pressable, "flex min-h-[64px] min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-4 pr-2 text-left")}
                >
                  <span className="relative shrink-0">
                    <ChildPhoto child={child} size={44} fallback={initials(child.fullName)} />
                    {!child.avatarUpdatedAt && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#ff9500] text-white ring-2 ring-white">
                        <Camera className="h-2.5 w-2.5" strokeWidth={2.6} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[15.5px] font-medium leading-snug text-[var(--color-text)]">{tr(child.fullName)}</span>
                      {allergyIds.has(child.id) && (
                        <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-[#ff3b30]/[0.12] px-1.5 text-[11.5px] font-semibold text-[#ff3b30]">
                          {tr("Allergiya")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-[#8e8e93]">
                      {guardian ? `${tr(RELATION_LABEL[guardian.relation] ?? "")}: ${guardian.guardian.fullName}` : tr("Ota-ona kiritilmagan")}
                      {!active && ` · ${tr("Nofaol")}`}
                    </span>
                  </span>
                  {active && (
                    <span
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13.5px] font-semibold tabular-nums"
                      style={{ backgroundColor: `${IOS.orange}1f`, color: IOS.orange }}
                      title={tr("Yulduzcha")}
                    >
                      <Star className="h-3.5 w-3.5" fill={IOS.orange} strokeWidth={0} />
                      {balance ?? "·"}
                    </span>
                  )}
                </button>
                {phone ? (
                  <a
                    href={telHref(phone)}
                    aria-label={tr("{0}ga qo'ng'iroq qilish", guardian!.guardian.fullName)}
                    className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#34c759] transition-colors active:bg-black/5"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#34c759]/[0.14]">
                      <PhoneIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    </span>
                  </a>
                ) : (
                  <span className="mr-2 w-11 shrink-0" aria-hidden="true" />
                )}
              </div>
            );
          })
        )}
      </Group>

      {/* Bola varag'i — bitta joyda hamma amallar */}
      <IosSheet open={view === "child" && !!shown} onClose={() => setView(null)} cancelLabel="Yopish" title={shown ? tr(shown.fullName) : ""}>
        {shown && (
          <>
            <div className="flex flex-col items-center gap-2 pt-1 text-center">
              <button
                type="button"
                onClick={() => setView("photo")}
                aria-label={tr("{0} surati", shown.fullName)}
                className="relative rounded-full transition-transform active:scale-[0.97]"
              >
                <ChildPhoto child={shown} size={88} fallback={initials(shown.fullName)} className="text-[30px]" />
                <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#f2f2f7] bg-[var(--color-primary)] text-white">
                  <Camera className="h-3.5 w-3.5" strokeWidth={2.4} />
                </span>
              </button>
              <p className="px-6 text-[20px] font-bold leading-tight text-[var(--color-text)]">{tr(shown.fullName)}</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {shown.group?.name && <Pill color={IOS.blue}>{tr(shown.group.name)}</Pill>}
                {allergyIds.has(shown.id) && <Pill color={IOS.red}>{tr("Allergiya")}</Pill>}
                {shown.status !== "ACTIVE" && <Pill>{tr("Nofaol")}</Pill>}
                {!shown.avatarUpdatedAt && <Pill color={IOS.orange}>{tr("Surati yo'q")}</Pill>}
              </div>
            </div>

            <SheetSection>
              <IosRow
                leading={<IosIcon icon={Camera} tint="orange" size={30} />}
                title={shown.avatarUpdatedAt ? tr("Suratni almashtirish") : tr("Surat qo'yish")}
                subtitle={tr("Surat Face ID uchun kerak")}
                onClick={() => setView("photo")}
              />
              {shown.status === "ACTIVE" && (
                <IosRow
                  leading={<IosIcon icon={Star} tint="orange" size={30} />}
                  title={tr("Yulduzcha berish")}
                  subtitle={tr("Hozir: {0} ta yulduzcha", starsByChild.get(shown.id) ?? 0)}
                  onClick={() => setView("star")}
                />
              )}
              <IosRow leading={<IosIcon icon={UserRound} tint="blue" size={30} />} title={tr("Profilni ochish")} subtitle={tr("Davomat, sog'liq, rivojlanish")} href={`/${slug}/children/${shown.id}`} />
            </SheetSection>

            <SheetSection title={tr("Ota-ona")}>
              {(shown.guardians ?? []).length === 0 ? (
                <IosRow title={<span className="text-[#8e8e93]">{tr("Ota-ona kiritilmagan")}</span>} />
              ) : (
                (shown.guardians ?? []).map((g) => (
                  <IosRow
                    key={g.guardian.id ?? g.guardian.fullName}
                    title={g.guardian.fullName}
                    subtitle={[tr(RELATION_LABEL[g.relation] ?? ""), g.guardian.phone].filter(Boolean).join(" · ")}
                    value={
                      g.guardian.phone ? (
                        <a
                          href={telHref(g.guardian.phone)}
                          aria-label={tr("{0}ga qo'ng'iroq qilish", g.guardian.fullName)}
                          className="flex h-10 items-center gap-1.5 rounded-full bg-[#34c759] px-3.5 text-[14px] font-semibold text-white transition-transform active:scale-[0.96]"
                        >
                          <PhoneIcon className="h-4 w-4" strokeWidth={2.4} />
                          {tr("Qo'ng'iroq")}
                        </a>
                      ) : undefined
                    }
                  />
                ))
              )}
            </SheetSection>
          </>
        )}
      </IosSheet>

      {shown && (
        <>
          <AwardStarsSheet open={view === "star"} onClose={() => setView("child")} slug={slug} child={shown} balance={starsByChild.get(shown.id)} />
          <ChildPhotoSheet open={view === "photo"} onClose={() => setView("child")} slug={slug} child={shown} canRemove={false} />
        </>
      )}
    </TeacherPage>
  );
}
