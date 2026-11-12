"use client";

import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { CameraIcon } from "@/components/ios/icons";
import { Group, GroupLink, ListRow, Row } from "@/components/ios/group";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet, SheetSection } from "@/components/ios/sheet";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ios/states";
import { GROUP_BLOCK, IOS } from "@/components/ios/tokens";
import iosStyles from "@/components/ios/ios.module.css";
import { useTr } from "@/i18n/tr";

/** `/app/desk/photos` javobi */
export interface PhotoStats {
  total: number;
  withPhoto: number;
  groups: PhotoGroup[];
}

interface PhotoGroup {
  /** null — guruhga biriktirilmagan bolalar ("Guruhsiz") */
  groupId: string | null;
  name: string;
  total: number;
  withPhoto: number;
  missing: { id: string; fullName: string }[];
}

/** Ro'yxatda birdaniga ko'rsatiladigan guruhlar; qolgani "Yana ko'rsatish" bilan */
const PAGE = 10;

/**
 * Filial admini bosh sahifasidagi "Bolalar surati" bo'limi: guruhlar
 * kesimida nechta bolaning surati bor, nechtasida yo'q. Guruh bosilsa —
 * surati yo'q bolalar ro'yxati; bola bosilsa uning profili ochiladi
 * (surat o'sha yerda qo'yiladi).
 */
export function PhotoStatsGroup({
  slug,
  query,
  manualRefresh,
}: {
  slug: string;
  query: UseQueryResult<PhotoStats>;
  manualRefresh: boolean;
}) {
  const tr = useTr();
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<PhotoGroup | null>(null);
  // Yopilish animatsiyasida varaq bo'shab qolmasin — oxirgi guruh saqlanadi
  const [last, setLast] = useState<PhotoGroup | null>(null);
  const openGroup = (g: PhotoGroup) => {
    setOpen(g);
    setLast(g);
  };

  const data = query.data;
  const missingTotal = data ? data.total - data.withPhoto : 0;
  const pct =
    data && data.total > 0
      ? Math.round((data.withPhoto / data.total) * 100)
      : 0;
  const shownGroup = open ?? last;

  return (
    <>
      <Group
        title={tr("Bolalar surati")}
        refreshing={query.isFetching && !query.isLoading && !manualRefresh}
        action={
          <GroupLink href={`/${slug}/children`}>{tr("Bolalar")}</GroupLink>
        }
        bare
      >
        {query.isLoading ? (
          <SkeletonRows rows={4} />
        ) : query.isError && !data ? (
          <ErrorState
            message={(query.error as Error).message}
            onRetry={() => query.refetch()}
            retrying={query.isFetching}
          />
        ) : !data || data.total === 0 ? (
          <EmptyState icon={CameraIcon} title="Filialda hali bola yo'q" />
        ) : (
          <div className={GROUP_BLOCK}>
            <div className="px-4 py-3.5">
              <div className="flex items-end justify-between gap-3">
                <p className="flex min-w-0 items-baseline gap-1.5">
                  <span className="text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-text)]">
                    {data.withPhoto}
                  </span>
                  <span className="text-[16px] font-semibold tabular-nums text-[#8e8e93]">
                    / {data.total}
                  </span>
                  <span className="ml-1 truncate text-[15px] text-[#8e8e93]">
                    {tr("bolaning surati bor")}
                  </span>
                </p>
                {missingTotal > 0 ? (
                  <Pill color={IOS.orange}>
                    {tr("{0} tasida yo'q", missingTotal)}
                  </Pill>
                ) : (
                  <Pill color={IOS.green}>{tr("Hammasida bor")}</Pill>
                )}
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-[#767680]/[0.12]"
                aria-hidden="true"
              >
                <div className={`${iosStyles.grow} flex h-full`}>
                  <span
                    className="rounded-full"
                    style={{ width: `${pct}%`, background: IOS.green }}
                  />
                </div>
              </div>
            </div>

            {data.groups.slice(0, shown).map((g) => {
              const missing = g.total - g.withPhoto;
              return (
                <ListRow
                  key={g.groupId ?? "none"}
                  onClick={missing > 0 ? () => openGroup(g) : undefined}
                  avatar={<IosAvatar name={tr(g.name)} letters={1} />}
                  title={tr(g.name)}
                  subtitle={
                    g.total === 0
                      ? tr("Guruhda bola yo'q")
                      : `${tr("{0} tasida bor", g.withPhoto)} · ${tr("{0} tasida yo'q", missing)}`
                  }
                  meta={
                    g.total === 0 ? null : missing > 0 ? (
                      <Pill
                        color={IOS.orange}
                        title={tr("{0} tasida yo'q", missing)}
                      >
                        {g.withPhoto}/{g.total}
                      </Pill>
                    ) : (
                      <Pill color={IOS.green} title={tr("Hammasida bor")}>
                        {g.withPhoto}/{g.total}
                      </Pill>
                    )
                  }
                />
              );
            })}
            {data.groups.length > shown && (
              <Row
                title={
                  <span className="text-[var(--color-primary)]">
                    {tr("Yana ko'rsatish")}
                  </span>
                }
                value={data.groups.length - shown}
                onClick={() => setShown((n) => n + PAGE)}
                chevron={false}
              />
            )}
          </div>
        )}
      </Group>

      {/* Guruhdagi surati yo'q bolalar */}
      <IosSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        cancelLabel="Yopish"
        title={shownGroup ? tr(shownGroup.name) : ""}
      >
        {shownGroup && (
          <SheetSection
            title={tr("Surati yo'q · {0}", shownGroup.missing.length)}
            footer={tr("Bolani bosing — profilida suratini qo'yasiz.")}
          >
            {shownGroup.missing.map((c) => (
              <ListRow
                key={c.id}
                href={`/${slug}/children/${c.id}`}
                avatar={<IosAvatar name={c.fullName} />}
                title={c.fullName}
                chevron
              />
            ))}
          </SheetSection>
        )}
      </IosSheet>
    </>
  );
}
