export const METHODS = ["CASH", "CARD", "BANK_TRANSFER"] as const;
export type CashMethod = (typeof METHODS)[number];

export const METHOD_LABEL: Record<CashMethod, string> = {
  CASH: "Naqd",
  CARD: "Karta",
  BANK_TRANSFER: "O'tkazma",
};

export interface MethodTotals {
  count: number;
  total: number;
}

export interface CashDay {
  date: string;
  income: Record<CashMethod, MethodTotals>;
  refunded: Record<CashMethod, MethodTotals>;
  incomeTotal: number;
  refundTotal: number;
  expensesTotal: number;
  expectedCash: number;
  netTotal: number;
  payments: {
    id: string;
    childId: string;
    childName: string;
    amount: number;
    method: CashMethod;
    status: "COMPLETED" | "REFUNDED";
    note: string | null;
    recordedByName: string | null;
    createdAt: string;
  }[];
  expenses: { id: string; amount: number; category: string; note: string | null; createdByName: string }[];
  closing: {
    expectedCash: number;
    countedCash: number;
    difference: number;
    note: string | null;
    closedByName: string;
    createdAt: string;
  } | null;
}

export interface DebtorRow {
  childId: string;
  childName: string;
  groupName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  balance: number;
  overdue: number;
  oldestDueDate: string | null;
}

export interface DebtorsResult {
  totalDebt: number;
  totalOverdue: number;
  rows: DebtorRow[];
}

export interface CashReport {
  month: string;
  billed: number;
  debt: number;
  collected: number;
  refundTotal: number;
  expensesTotal: number;
  salaryPaid: number;
  salaryUnpaid: number;
  net: number;
  byMethod: Record<CashMethod, MethodTotals>;
  days: { date: string; total: number }[];
  expensesByCategory: { category: string; total: number }[];
}

export const EXPENSE_CATEGORIES = ["Xo'jalik mollari", "Tozalik", "Ta'mirlash", "Ofis", "Transport", "Boshqa"];

/** Toshkent bo'yicha bugungi sana (YYYY-MM-DD). */
export function todayTashkent(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}

export function saveCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = "﻿" + rows.map((r) => r.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type PayState = "NONE" | "PAID" | "PARTIAL" | "OVERDUE";

export const PAY_STATE: Record<PayState, { label: string; tone: "success" | "warning" | "danger" | "neutral"; dot: string }> = {
  PAID: { label: "To'lagan", tone: "success", dot: "bg-[var(--color-success)]" },
  PARTIAL: { label: "Qisman / muddati kelmagan", tone: "warning", dot: "bg-[var(--color-warning)]" },
  OVERDUE: { label: "Muddati o'tgan", tone: "danger", dot: "bg-[var(--color-danger)]" },
  NONE: { label: "Hisob-faktura yo'q", tone: "neutral", dot: "bg-[var(--color-border)]" },
};

export interface GroupPaymentSummary {
  groupId: string;
  name: string;
  total: number;
  paid: number;
  partial: number;
  overdue: number;
  none: number;
  billed: number;
  collected: number;
}

export interface GroupChildRow {
  childId: string;
  childName: string;
  state: PayState;
  billed: number;
  paid: number;
  remaining: number;
  dueDate: string | null;
}

export function currentMonth(): string {
  return todayTashkent().slice(0, 7);
}
