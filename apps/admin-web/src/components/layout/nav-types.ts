import type { ComponentType } from "react";
import type { IconProps } from "@/components/ui/icons";

// `IconProps` — ikonkalar to'plamining o'z tipi: `filled` bayrog'i ham bor,
// faol bo'lim to'ldirilgan ikonka bilan belgilanadi.
export type NavIcon = ComponentType<IconProps>;

export interface NavLeaf {
  href: string;
  label: string;
  icon: NavIcon;
  show: boolean;
  exact?: boolean;
  /** O'ng chetdagi raqamli belgi (masalan yangi arizalar soni). */
  badge?: number;
  badgeTone?: "warning" | "success" | "danger";
}

/** Ochilib-yopiladigan bo'lim: ichidagi havolalar daraxt chizig'i bilan ulanadi. */
export interface NavSection {
  id: string;
  label: string;
  icon: NavIcon;
  items: NavLeaf[];
}

export type NavEntry = NavLeaf | NavSection;

export function isSection(entry: NavEntry): entry is NavSection {
  return "items" in entry;
}
