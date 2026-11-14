"use client";

import { use } from "react";
import Link from "next/link";
import { findLevel, findTopic } from "../../data";
import { MemoryGame } from "../memory-game";
import { useTr } from "@/i18n/tr";

/**
 * O'yin ekrani: `/oyinlar/juftini-top/<mavzu>?daraja=oson|orta|qiyin`.
 * Daraja manzilda — sahifani yangilasa ham shu o'yin qayta boshlanadi.
 */
export default function MemoryPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; mavzu: string }>;
  searchParams: Promise<{ daraja?: string }>;
}) {
  const tr = useTr();
  const { slug, mavzu } = use(params);
  const { daraja } = use(searchParams);
  const topic = findTopic(mavzu);
  const level = findLevel(daraja);

  if (!topic) {
    return (
      <div className="mx-auto w-full max-w-[520px] px-4 pt-16 text-center">
        <p className="text-[19px] font-extrabold text-[var(--p-ink)]">{tr("Bunday mavzu topilmadi")}</p>
        <Link
          href={`/ota-ona/${slug}/oyinlar/juftini-top`}
          className="mt-6 inline-flex rounded-full bg-[var(--p-coral)] px-5 py-2.5 text-[14px] font-bold text-white"
        >
          {tr("Mavzularga qaytish")}
        </Link>
      </div>
    );
  }

  return <MemoryGame key={`${topic.id}:${level.id}`} slug={slug} topic={topic} level={level} />;
}
