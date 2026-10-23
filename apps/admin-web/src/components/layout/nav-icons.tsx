import {
  AlarmClock,
  Baby,
  BadgePercent,
  Banknote,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChartColumn,
  CircleHelp,
  ClipboardCheck,
  Coins,
  FileText,
  Globe,
  House,
  IdCard,
  KeyRound,
  Lightbulb,
  Phone,
  ScanFace,
  School,
  Settings,
  ShieldCheck,
  Star,
  Store,
  UsersRound,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import { IOS_TINT, type IosTint } from "@/features/director/ios-icon";
import type { NavIcon } from "./nav-types";

/**
 * Menyu ikonkalari — iOS uslubida: lucide (SF Symbols'ga yaqin) belgilar va
 * har birining o'z tizim rangi. Yon panelda va «Menyu» varag'ida ular
 * Sozlamalar ilovasidagidek rangli plitkada (`NavTile`) chiqadi; telefondagi
 * pastki tab panelda — bir rangli belgi (iOS tab bar kabi). Faol bo'lim
 * (`filled`) qalinroq chiziq bilan ajratiladi — lucide'da to'ldirilgan
 * variantlar yo'q.
 */
type TintedIcon = NavIcon & { tint: IosTint };

function navIcon(Icon: LucideIcon, tint: IosTint): TintedIcon {
  const Component = ({ filled, className, style }: { filled?: boolean; className?: string; style?: CSSProperties }) => (
    <Icon className={className} style={style} strokeWidth={filled ? 2.5 : 2} aria-hidden="true" />
  );
  Component.displayName = `NavIcon(${Icon.displayName ?? "lucide"})`;
  return Object.assign(Component, { tint });
}

// Ma'no admin-web/CLAUDE.md dagi bilan bir xil: bola — Baby, guruh — UsersRound,
// filial — School, xodim — IdCard, pul — Wallet, hisobot — ChartColumn, audit — ShieldCheck.
export const HomeIcon = navIcon(House, "blue");
export const ChildIcon = navIcon(Baby, "orange");
export const GroupIcon = navIcon(UsersRound, "orange");
export const BuildingIcon = navIcon(School, "blue");
export const TeacherIcon = navIcon(IdCard, "indigo");
export const KeyIcon = navIcon(KeyRound, "gray");
export const MoneyIcon = navIcon(Banknote, "emerald");
export const WalletIcon = navIcon(Wallet, "emerald");
export const CoinIcon = navIcon(Coins, "orange");
export const PercentIcon = navIcon(BadgePercent, "pink");
export const ChartIcon = navIcon(ChartColumn, "indigo");
export const AuditIcon = navIcon(ShieldCheck, "gray");
export const SettingsIcon = navIcon(Settings, "gray");
export const BellIcon = navIcon(Bell, "red");
export const BookIcon = navIcon(BookOpen, "teal");
export const BulbIcon = navIcon(Lightbulb, "green");
export const NoteIcon = navIcon(FileText, "blue");
export const CalendarIcon = navIcon(CalendarDays, "red");
export const ChecklistIcon = navIcon(ClipboardCheck, "green");
export const ClockIcon = navIcon(AlarmClock, "orange");
export const PhoneIcon = navIcon(Phone, "green");
export const FaceIdIcon = navIcon(ScanFace, "purple");
export const GlobeIcon = navIcon(Globe, "pink");
export const MealIcon = navIcon(Utensils, "orange");
export const ShopIcon = navIcon(Store, "pink");
export const StarIcon = navIcon(Star, "orange");
export const BriefcaseIcon = navIcon(BriefcaseBusiness, "indigo");
export const QuestionIcon = navIcon(CircleHelp, "blue");

/** Bo'limning o'z rangi (telefon «Menyu»sida ham shu) — bo'lmasa ikonkaning rangi */
export const SECTION_TINT: Record<string, IosTint> = {
  "bugungi-ishlar": "blue",
  qabul: "orange",
  xodimlar: "indigo",
  kundalik: "teal",
  "face-id": "purple",
  coin: "orange",
  foydali: "green",
  moliya: "emerald",
  lending: "pink",
  filiallar: "blue",
  guruhlarim: "orange",
  oqituvchilar: "indigo",
  darsliklar: "teal",
};

export function tintOf(icon: NavIcon, sectionId?: string): string {
  const tint = (sectionId && SECTION_TINT[sectionId]) || (icon as Partial<TintedIcon>).tint || "accent";
  return IOS_TINT[tint];
}

/**
 * iOS plitkasi: tekis tizim rangi, ichida oq belgi (belgi — plitkaning
 * ~57%i). Burchak: 30px → 8px, 52px → 14px (Sozlamalar / ilovalar ekrani).
 */
export function NavTile({
  icon: Icon,
  color,
  size = 30,
  active = false,
  className,
}: {
  icon: NavIcon;
  color: string;
  size?: number;
  active?: boolean;
  className?: string;
}) {
  const glyph = Math.round(size * 0.57);
  return (
    <span
      className={`flex shrink-0 items-center justify-center text-white ${className ?? ""}`}
      style={{ width: size, height: size, borderRadius: size <= 32 ? 8 : Math.round(size * 0.27), backgroundColor: color }}
      aria-hidden="true"
    >
      <Icon filled={active} style={{ width: glyph, height: glyph }} />
    </span>
  );
}
