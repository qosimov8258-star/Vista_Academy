export type CallKind = "DEBT" | "ABSENT" | "LEAD";

export interface CallItem {
  kind: CallKind;
  subjectId: string;
  title: string;
  subtitle: string;
  contactName: string | null;
  phone: string | null;
  badge: string | null;
  done: boolean;
  doneNote: string | null;
  calledByName: string | null;
}

export interface CallsResult {
  date: string;
  items: CallItem[];
  open: number;
}

export const CALL_KIND_LABEL: Record<CallKind, string> = {
  DEBT: "Qarz",
  ABSENT: "Kelmagan bola",
  LEAD: "Ariza",
};

export interface BoardGroup {
  groupId: string | null;
  name: string;
  total: number;
  present: number;
  absent: number;
  sick: number;
  notMarked: number;
  pickedUp: number;
}

export interface BoardResult {
  date: string;
  totals: { total: number; present: number; absent: number; sick: number; notMarked: number; pickedUp: number };
  mealCount: number;
  stillHere: number;
  groups: BoardGroup[];
  staffAway: { fullName: string; position: string; status: "ABSENT" | "SICK" | "ON_LEAVE" }[];
}

export interface PickupChild {
  childId: string;
  childName: string;
  groupName: string | null;
  guardians: { id: string; fullName: string; phone: string; relation: string; canPickup: boolean }[];
  pickup: { pickedByName: string; relation: string | null; note: string | null; recordedByName: string; createdAt: string } | null;
}

export interface WeeklyResult {
  from: string;
  to: string;
  children: number;
  attendancePercent: number | null;
  daily: { date: string; present: number; absent: number; sick: number }[];
  frequentlyAbsent: { name: string; days: number }[];
  collected: number;
  totalDebt: number;
  overdueDebt: number;
  debtorsCount: number;
  newLeads: number;
  wonLeads: number;
  staffAbsences: number;
}

export const RELATION_LABEL: Record<string, string> = {
  MOTHER: "Ona",
  FATHER: "Ota",
  GRANDPARENT: "Buvi/bobo",
  OTHER: "Boshqa",
};

export function todayTashkent(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
}
