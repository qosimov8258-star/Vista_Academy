import {
  Armchair,
  Building2,
  Car,
  Ellipsis,
  Landmark,
  Megaphone,
  Package,
  Paperclip,
  SprayCan,
  Utensils,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { PaymentMethod } from "@/lib/types";

/**
 * Xarajat turkumlari — backend (`api/.../cash-desk/expense-categories.ts`)
 * bilan bir xil ro'yxat va tartib. Har birining o'z ikonkasi va iOS rangi.
 */
export const EXPENSE_CATEGORIES: { name: string; icon: LucideIcon; color: string }[] = [
  { name: "Oziq-ovqat", icon: Utensils, color: "#ff9500" },
  { name: "Xo'jalik mollari", icon: Package, color: "#34c759" },
  { name: "Tozalik", icon: SprayCan, color: "#00c7be" },
  { name: "Kommunal", icon: Zap, color: "#30b0c7" },
  { name: "Ijara", icon: Building2, color: "#5856d6" },
  { name: "Ta'mirlash", icon: Wrench, color: "#ff2d55" },
  { name: "Jihozlar", icon: Armchair, color: "#af52de" },
  { name: "Transport", icon: Car, color: "#007aff" },
  { name: "Ofis", icon: Paperclip, color: "#007aff" },
  { name: "Reklama", icon: Megaphone, color: "#ff9500" },
  { name: "Soliq", icon: Landmark, color: "#ff3b30" },
  { name: "Boshqa", icon: Ellipsis, color: "#8e8e93" },
];

const OTHER = EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

/** Ro'yxatda yo'q (eski) turkum ham ko'rinsin — kulrang "…" bilan */
export function categoryMeta(name: string) {
  return EXPENSE_CATEGORIES.find((c) => c.name === name) ?? { ...OTHER, name };
}

/** Xarajat qanday to'langan — 3×2 kapsulalar, sukut naqd */
export const EXPENSE_METHODS: PaymentMethod[] = ["CASH", "CARD", "BANK_TRANSFER", "CLICK", "PAYME", "OTHER"];

/** `GET /app/cash/expenses` va `GET /app/cash/day` dagi xarajat qatori */
export interface ExpenseRow {
  id: string;
  date: string;
  amount: number;
  category: string;
  method: PaymentMethod;
  note: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  /** Naqddan boshqa usulda — chek surati bor */
  hasReceiptImage: boolean;
  /** Kassa yopilgan kun — tahrirlab/o'chirib bo'lmaydi */
  locked: boolean;
}

export interface ExpensesMonth {
  month: string;
  total: number;
  cashTotal: number;
  prevTotal: number;
  byCategory: { category: string; total: number; count: number }[];
  items: ExpenseRow[];
}
