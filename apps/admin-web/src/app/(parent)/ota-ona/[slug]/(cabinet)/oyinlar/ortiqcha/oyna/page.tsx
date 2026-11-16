"use client";

import { use } from "react";
import { findOddLevel } from "../odd-data";
import { OddGame } from "../odd-game";

/** O'yin ekrani: `/oyinlar/ortiqcha/oyna?daraja=oson|orta|qiyin` */
export default function OddGamePlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ daraja?: string }>;
}) {
  const { slug } = use(params);
  const { daraja } = use(searchParams);
  const level = findOddLevel(daraja);
  return <OddGame key={level.id} slug={slug} level={level} />;
}
