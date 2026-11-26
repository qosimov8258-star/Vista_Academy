export type CallKind = "DEBT" | "ABSENT" | "LEAD" | "FAKE_RECEIPT";

export interface CallItem {
  kind: CallKind;
  subjectId: string;
  /** Qo'ng'iroq qaysi bola haqida (ariza uchun null) */
  childId: string | null;
  /** Bolaning surati bo'lsa — versiyasi (keshni yangilash uchun), aks holda null */
  photoVersion: string | null;
  title: string;
  subtitle: string;
  contactName: string | null;
  phone: string | null;
  contacts?: { name: string | null; relation: string | null; phone: string | null }[];
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

/** "Qo'ng'iroq qilinganlar" — javob olingan qo'ng'iroqlar (oxirgi 30 kun): arizalar, qarz, kelmagan bola */
export interface CalledLeadsResult {
  items: {
    kind: Extract<CallKind, "LEAD" | "DEBT" | "ABSENT">;
    /** Ro'yxat kaliti: ariza — bitta, bola qo'ng'irog'i — har kun alohida */
    key: string;
    subjectId: string;
    /** Faqat arizada */
    leadId: string | null;
    childId: string | null;
    photoVersion: string | null;
    title: string;
    parentName: string;
    phone: string | null;
    source: string | null;
    stage: string | null;
    appliedAt: string | null;
    groupName: string | null;
    calledAt: string;
    calledByName: string;
    note: string | null;
    /** Ariza shu operator filialida — CRM'da ochiladi */
    inMyBranch: boolean;
  }[];
}

export const CALL_KIND_LABEL: Record<CallKind, string> = {
  DEBT: "Qarz",
  ABSENT: "Kelmagan bola",
  LEAD: "Ariza",
  FAKE_RECEIPT: "Soxta chek",
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
  groups: {
    id: string;
    name: string;
    childrenCount: number;
    teachers: string[];
    daily: { date: string; present: number; absent: number; sick: number }[];
  }[];
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
