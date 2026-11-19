import { notFound } from "next/navigation";
import { findLogicGame } from "../mantiq/games";
import { LogicIntro } from "../mantiq/intro";

/**
 * Mantiqiy o'yinlar («Nima keyin keladi?», «Soyasini top» va boshqalar) —
 * bitta yo'l: /oyinlar/<o'yin>. Boshqa o'yinlarning (juftini-top,
 * kim-qichqirdi, ortiqcha) o'z papkasi bor, ular shu yerga tushmaydi.
 */
export default async function LogicGamePage({ params }: { params: Promise<{ slug: string; oyin: string }> }) {
  const { slug, oyin } = await params;
  const game = findLogicGame(oyin);
  if (!game) notFound();
  return <LogicIntro slug={slug} game={game} />;
}
