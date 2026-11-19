import { notFound } from "next/navigation";
import { findLogicGame, findLogicLevel } from "../../mantiq/games";
import { LogicPlay } from "../../mantiq/play";

/** Mantiqiy o'yinning o'zi; `?daraja=` — Oson / O'rtacha / Qiyin */
export default async function LogicGamePlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; oyin: string }>;
  searchParams: Promise<{ daraja?: string }>;
}) {
  const { slug, oyin } = await params;
  const { daraja } = await searchParams;
  const game = findLogicGame(oyin);
  if (!game) notFound();
  const level = findLogicLevel(game, daraja);
  return <LogicPlay key={level.id} slug={slug} gameId={game.id} levelId={level.id} />;
}
