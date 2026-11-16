import { Apple, Backpack, Brain, HeartHandshake, HeartPulse, Puzzle, Sprout, type LucideIcon } from "lucide-react";
import type { ArticleCategory } from "@/lib/types";
import type { IosTint } from "@/features/director/ios-icon";

/**
 * Maqola mavzulari — xodim paneli ham, ota-ona kabineti ham shu ro'yxatdan
 * foydalanadi (nom `tr()` bilan o'raladi). Tartib — tanlagichdagi tartib.
 * API'dagi `ArticleCategory` enum bilan mos bo'lishi kerak.
 */
export const ARTICLE_CATEGORIES: Record<ArticleCategory, { label: string; icon: LucideIcon; tint: IosTint }> = {
  PSYCHOLOGY: { label: "Psixolog maslahati", icon: Brain, tint: "purple" },
  DEVELOPMENT: { label: "Bola rivojlanishi", icon: Sprout, tint: "green" },
  HEALTH: { label: "Salomatlik va gigiyena", icon: HeartPulse, tint: "red" },
  NUTRITION: { label: "To'g'ri ovqatlanish", icon: Apple, tint: "orange" },
  FAMILY: { label: "Oilaviy tarbiya", icon: HeartHandshake, tint: "pink" },
  ADAPTATION: { label: "Bog'chaga moslashish", icon: Backpack, tint: "blue" },
  HOME_GAMES: { label: "Uyda o'yinlar", icon: Puzzle, tint: "teal" },
};

export const ARTICLE_CATEGORY_ORDER = Object.keys(ARTICLE_CATEGORIES) as ArticleCategory[];

/** Mavzu nomi (o'zbekcha kalit — ko'rsatishda `tr()` bilan o'rang) */
export function articleCategoryLabel(category: ArticleCategory): string {
  return ARTICLE_CATEGORIES[category]?.label ?? category;
}
