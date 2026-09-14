"use client";

import { use } from "react";
import Link from "next/link";
import { ClockIcon } from "@/components/ui/icons";
import styles from "../../../parent.module.css";
import { useTales } from "../content";
import { useLearned } from "../store";
import { Chip, EmptyCard, FoydaliHeader, ListSkeleton, LoadErrorCard, TaleCover, TaleIcon } from "../ui";

/** Ertaklar ro'yxati — muqovali kartalar */
export default function TalesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const base = `/ota-ona/${slug}/foydali`;
  const talesQuery = useTales();
  const tales = talesQuery.data;
  const { has } = useLearned();

  return (
    <div className="mx-auto w-full max-w-[520px] px-4">
      <FoydaliHeader
        backHref={base}
        backLabel="Foydali"
        title="Ertaklar"
        subtitle="Uxlashdan oldin birga o'qing — oxirida bolangizga savollar bor"
      />

      {!tales ? (
        talesQuery.isError ? (
          <LoadErrorCard error={talesQuery.error} onRetry={() => talesQuery.refetch()} loginHref={`/ota-ona/${slug}/kirish`} />
        ) : (
          <ListSkeleton rows={2} tall />
        )
      ) : tales.length === 0 ? (
        <EmptyCard
          Icon={TaleIcon}
          tone="sky"
          title="Hozircha ertak yo'q"
          text="Tarbiyachi ertak qo'shishi bilan u shu yerda paydo bo'ladi."
        />
      ) : (
        <ul className="mt-5 space-y-4">
          {tales.map((tale) => {
            const read = has("tales", tale.id);
            return (
              <li key={tale.id}>
                <Link
                  href={`${base}/ertaklar/${tale.id}`}
                  className="block overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)] transition-transform active:scale-[0.99]"
                >
                  <div className="aspect-[16/8] w-full overflow-hidden">
                    <TaleCover kind={tale.cover} className="h-full w-full" />
                  </div>
                  <div className="p-4">
                    <p className={`${styles.roundedFont} text-[20px] font-extrabold text-[var(--p-ink)]`}>{tale.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Chip tone="sky">{tale.origin}</Chip>
                      <Chip>
                        <ClockIcon className="mr-1 h-3.5 w-3.5" />
                        {tale.minutes} daqiqa
                      </Chip>
                      {read && <Chip tone="mint">O&apos;qildi</Chip>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
