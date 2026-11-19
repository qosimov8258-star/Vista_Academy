"use client";

import type { ComponentType } from "react";
import { CountGame } from "./count-game";
import { FoodGame } from "./food-game";
import { findLogicGame, findLogicLevel, type LogicGame, type LogicGameId, type LogicLevel } from "./games";
import { LetterGame } from "./letter-game";
import { PatternGame } from "./pattern-game";
import { ShadowGame } from "./shadow-game";
import { SizeGame } from "./size-game";
import { SortGame } from "./sort-game";

const PLAYERS: Record<LogicGameId, ComponentType<{ slug: string; game: LogicGame; level: LogicLevel }>> = {
  keyingisi: PatternGame,
  "soyasini-top": ShadowGame,
  "kichikdan-kattaga": SizeGame,
  "kim-nima-yeydi": FoodGame,
  savatcha: SortGame,
  nechta: CountGame,
  "qaysi-harf": LetterGame,
};

/** O'yin sahnasi: id va daraja bo'yicha kerakli o'yin ochiladi */
export function LogicPlay({ slug, gameId, levelId }: { slug: string; gameId: LogicGameId; levelId: string }) {
  const game = findLogicGame(gameId);
  if (!game) return null;
  const level = findLogicLevel(game, levelId);
  const Play = PLAYERS[game.id];
  return <Play slug={slug} game={game} level={level} />;
}
