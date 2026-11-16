"use client";

import { use } from "react";
import { findSoundLevel } from "../../data";
import { SoundGame } from "../sound-game";

/** O'yin ekrani: `/oyinlar/kim-qichqirdi/oyna?daraja=oson|orta|qiyin` */
export default function SoundGamePlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ daraja?: string }>;
}) {
  const { slug } = use(params);
  const { daraja } = use(searchParams);
  const level = findSoundLevel(daraja);
  return <SoundGame key={level.id} slug={slug} level={level} />;
}
