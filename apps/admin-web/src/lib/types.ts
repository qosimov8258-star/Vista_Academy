export type TenantUserRole = "NETWORK_ADMIN" | "BRANCH_ADMIN" | "FINANCE" | "MANAGER" | "TEACHER";

/** Kirish sahifasida ko'rsatiladigan ochiq ma'lumot (token talab qilinmaydi). */
export interface PublicOrganization {
  name: string;
  slug: string;
}

export interface TenantAuthenticatedUser {
  id: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  branchId: string | null;
  branchSlug: string | null;
  branchName: string | null;
  email: string;
  fullName: string;
  role: TenantUserRole;
  /** Profil rasmi bor bo'lsa — oxirgi yangilangan vaqti (kesh uchun). */
  avatarUpdatedAt: string | null;
}

export type OrganizationStatus = "ACTIVE" | "SUSPENDED";

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
  currency: string;
  createdAt: string;
  /** Belgisi bor bo'lsa — oxirgi yangilangan vaqti (rasm keshini yangilash uchun). */
  avatarUpdatedAt: string | null;
  avatarMimeType: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: string;
  branches: Branch[];
}

export type GroupStatus = "ACTIVE" | "INACTIVE";

export interface GroupTeacherLink {
  groupId: string;
  employeeId: string;
  employee?: { id: string; fullName: string; position: string };
  branch?: { id: string; name: string };
  group?: { id: string; name: string };
}

export interface Group {
  id: string;
  branchId: string;
  name: string;
  capacity: number;
  status: GroupStatus;
  createdAt: string;
  _count?: { children: number };
  teachers?: GroupTeacherLink[];
}

export type ChildStatus = "ACTIVE" | "INACTIVE" | "QUARANTINED";

export type Gender = "MALE" | "FEMALE";

/** Guruh kartochkasidagi bola (guruh ko'rinishi uchun qisqartirilgan). */
export interface GroupChild {
  id: string;
  publicId: number;
  fullName: string;
  gender: Gender | null;
  birthDate: string | null;
  status: ChildStatus;
}

/** `GET /app/groups/:id/overview` javobi. */
export interface GroupOverview {
  group: { id: string; name: string; capacity: number; status: GroupStatus; createdAt: string };
  branch: { id: string; name: string };
  teachers: { id: string; fullName: string; position: string; isActive: boolean }[];
  children: {
    total: number;
    active: number;
    boys: number;
    girls: number;
    unknownGender: number;
    items: GroupChild[];
  };
}

/** `GET /app/groups/:id/attendance` javobi. */
export interface GroupAttendanceRange {
  from: string;
  to: string;
  totalChildren: number;
  days: { date: string; present: number; absent: number; unmarked: number }[];
  children: { childId: string; fullName: string; present: number; absent: number; rate: number | null }[];
}

export interface Child {
  id: string;
  organizationId: string;
  /** Xodimlar va ota-onalar ishlatadigan qisqa raqam; UI da "id12345" ko'rinishida. */
  publicId: number;
  branchId: string;
  groupId: string | null;
  firstName: string;
  lastName: string;
  /** "Familiya Ism" — qidiruv va ro'yxatlar shu maydonni ishlatadi. */
  fullName: string;
  /** Migratsiyadan oldin qo'shilgan bolalarda noma'lum bo'lishi mumkin. */
  gender: Gender | null;
  birthDate: string | null;
  status: ChildStatus;
  quarantineUntil: string | null;
  quarantineReason: string | null;
  /** Surati bor bo'lsa — oxirgi yangilangan vaqti (rasm keshini yangilash uchun). */
  avatarUpdatedAt: string | null;
  createdAt: string;
  group?: { id: string; name: string } | null;
  branch?: { id: string; name: string };
  /** Asosiy vasiy birinchi bo'lib keladi. */
  guardians?: ChildGuardian[];
}

export interface Employee {
  id: string;
  organizationId: string;
  branchId: string;
  fullName: string;
  position: string;
  isActive: boolean;
  createdAt: string;
  /** Kabineti bo'lmagan xodimda null — u tizimga kirmaydi. */
  tenantUser?: { id: string; email: string; role: TenantUserRole; isActive: boolean } | null;
  teachingGroups?: GroupTeacherLink[];
  /** Oylik sxemasi — ro'yxat bilan birga keladi, alohida so'rov kerak emas. */
  salaryScheme?: { ruleType: "FIXED" | "PER_HOUR" | "PER_CHILD"; fixedAmount: string; rate: string } | null;
}

export type AttendanceStatus = "PRESENT" | "ABSENT";

export interface AttendanceChild {
  childId: string;
  fullName: string;
  groupName: string | null;
  status: AttendanceStatus | null;
  note: string | null;
}

export interface AttendanceDay {
  date: string;
  children: AttendanceChild[];
}

export type InvoiceStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";

export interface Invoice {
  id: string;
  organizationId: string;
  branchId: string;
  childId: string;
  amount: string;
  discountAmount: string;
  paidAmount: string;
  currency: string;
  period: string;
  dueDate: string;
  status: InvoiceStatus;
  paidAt: string | null;
  createdAt: string;
  child?: { id: string; fullName: string };
}

export type PaymentMethod = "CASH" | "BANK_TRANSFER";
export type PaymentStatus = "COMPLETED" | "REFUNDED";

export interface Payment {
  id: string;
  organizationId: string;
  branchId: string;
  childId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  note: string | null;
  refundedAt: string | null;
  createdAt: string;
  child?: { id: string; fullName: string };
}

export type LedgerEntryType = "CHARGE" | "DISCOUNT" | "PAYMENT" | "REFUND" | "ADJUSTMENT";

export interface LedgerEntry {
  id: string;
  childId: string;
  type: LedgerEntryType;
  amount: string;
  note: string | null;
  createdAt: string;
  invoice?: { id: string; period: string } | null;
  payment?: { id: string; method: PaymentMethod; status: PaymentStatus } | null;
}

export interface TenantUser {
  id: string;
  email: string;
  fullName: string;
  role: TenantUserRole;
  branchId: string | null;
  isActive: boolean;
  createdAt: string;
  branch: { id: string; name: string; slug: string } | null;
}

export interface DashboardSummary {
  childrenCount: number;
  activeGroupsCount: number;
  employeesCount: number;
  monthRevenue: number;
  outstandingDebt: number;
  todayAttendance: { present: number; absent: number };
  todayStaffAttendance: { present: number; absent: number };
  todayDailyReportsFilled: number;
  activeLeadsCount: number;
  pendingNotificationsCount: number;
}

export interface MenuEntry {
  id: string;
  branchId: string;
  date: string;
  breakfast: string | null;
  lunch: string | null;
  snack: string | null;
}

export type StaffAttendanceStatus = "PRESENT" | "ABSENT";

export interface StaffAttendanceEmployee {
  employeeId: string;
  fullName: string;
  position: string;
  status: StaffAttendanceStatus | null;
  note: string | null;
}

export interface StaffAttendanceDay {
  date: string;
  employees: StaffAttendanceEmployee[];
}

export type EatingQuality = "GOOD" | "AVERAGE" | "POOR";
export type MoodStatus = "HAPPY" | "NEUTRAL" | "UPSET";

export interface DailyReport {
  id: string;
  childId: string;
  date: string;
  eatingQuality: EatingQuality | null;
  sleepMinutes: number | null;
  mood: MoodStatus | null;
  toiletNotes: string | null;
  activityNotes: string | null;
  createdAt: string;
}

export interface DailyReportChild {
  childId: string;
  fullName: string;
  groupName: string | null;
  report: DailyReport | null;
}

export interface DailyReportDay {
  date: string;
  children: DailyReportChild[];
}

export type DevelopmentRating = "BELOW_EXPECTED" | "ON_TRACK" | "ABOVE_EXPECTED";

export interface DevelopmentAssessment {
  id: string;
  childId: string;
  period: string;
  speechRating: DevelopmentRating | null;
  motorRating: DevelopmentRating | null;
  socialRating: DevelopmentRating | null;
  cognitiveRating: DevelopmentRating | null;
  note: string | null;
  createdAt: string;
}

// ===== CRM / Navbat =====
export type AgeGroup = "AGE_1_2" | "AGE_2_3" | "AGE_3_4" | "AGE_4_5" | "AGE_5_6" | "AGE_6_7";
export type LeadSource = "WEBSITE" | "REFERRAL" | "SOCIAL_MEDIA" | "WALK_IN" | "OTHER";
export type LeadStage = "NEW" | "TRIAL_DAY_SCHEDULED" | "CONTRACT" | "WON" | "LOST";
export type LeadActivityType = "CALL" | "MESSAGE" | "MEETING" | "TRIAL_DAY" | "STAGE_CHANGE" | "NOTE";

export interface Lead {
  id: string;
  organizationId: string;
  branchId: string;
  childFullName: string;
  childBirthDate: string | null;
  ageGroup: AgeGroup | null;
  parentName: string;
  parentPhone: string;
  source: LeadSource;
  stage: LeadStage;
  lostReason: string | null;
  assignedToUserId: string | null;
  convertedChildId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface LeadStats {
  totalActive: number;
  byStage: Record<LeadStage, number>;
}

// ===== Sog'liq / Tibbiyot =====
export type BloodType =
  | "A_POSITIVE"
  | "A_NEGATIVE"
  | "B_POSITIVE"
  | "B_NEGATIVE"
  | "AB_POSITIVE"
  | "AB_NEGATIVE"
  | "O_POSITIVE"
  | "O_NEGATIVE";
export type VaccinationStatus = "SCHEDULED" | "DONE" | "MISSED";

export interface HealthProfile {
  id: string;
  childId: string;
  bloodType: BloodType | null;
  chronicConditions: string | null;
  allergies: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vaccination {
  id: string;
  childId: string;
  name: string;
  scheduledDate: string;
  doneDate: string | null;
  status: VaccinationStatus;
  note: string | null;
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  childId: string;
  medicationName: string;
  dose: string;
  givenAt: string;
  givenByUserId: string | null;
  parentAuthorized: boolean;
  note: string | null;
  createdAt: string;
}

// ===== Ota-ona / Guardian =====
export type GuardianRelation = "FATHER" | "MOTHER" | "GRANDPARENT" | "OTHER";

export interface Guardian {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string;
  createdAt: string;
}

export interface GuardianCabinetCredentials {
  guardianId: string;
  fullName: string;
  /** Login — telefon raqami. */
  login: string;
  /** Parol faqat shu javobda keladi: bazada xesh saqlanadi. */
  password: string;
}

export interface ChildGuardian {
  id: string;
  childId: string;
  guardianId: string;
  relation: GuardianRelation;
  isPrimary: boolean;
  canPickup: boolean;
  canViewFinance: boolean;
  canReceiveNotifications: boolean;
  createdAt: string;
  guardian: Guardian & {
    isActive?: boolean;
    lastLoginAt?: string | null;
    /** Kabinet ochilganmi — paroli bormi degani. */
    hasCabinet?: boolean;
  };
}

// ===== HR / Payroll =====
export type SalaryRuleType = "FIXED" | "PER_HOUR" | "PER_CHILD";
export type PayrollStatus = "DRAFT" | "PAID";

export interface SalaryScheme {
  id: string;
  employeeId: string;
  ruleType: SalaryRuleType;
  fixedAmount: string;
  rate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  employeeId: string;
  branchId: string;
  date: string;
  hours: string;
  note: string | null;
  createdAt: string;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  branchId: string;
  period: string;
  baseAmount: string;
  bonusAmount: string;
  penaltyAmount: string;
  totalAmount: string;
  status: PayrollStatus;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; fullName: string; position: string };
  branch?: { id: string; name: string };
}

// ===== Bildirishnomalar =====
export type NotificationEventType =
  | "CHILD_ABSENT"
  | "DAILY_REPORT_READY"
  | "PAYMENT_DUE"
  | "PAYMENT_OVERDUE"
  | "VACCINATION_DUE"
  | "QUARANTINE_ALERT"
  | "LEAD_FOLLOW_UP"
  | "CUSTOM";
export type NotificationChannel = "SMS" | "TELEGRAM" | "EMAIL" | "PHONE_CALL" | "IN_APP";
export type NotificationStatus = "PENDING" | "SENT";

export interface NotificationLog {
  id: string;
  organizationId: string;
  branchId: string;
  childId: string | null;
  eventType: NotificationEventType;
  channel: NotificationChannel | null;
  recipientName: string;
  recipientContact: string | null;
  message: string;
  status: NotificationStatus;
  sentByUserId: string | null;
  sentAt: string | null;
  createdAt: string;
  child?: { id: string; fullName: string } | null;
}

/** Super Adminning filial hisoboti (`/app/dashboard/branch-report`). */
export interface BranchReport {
  branch: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    timezone: string;
    currency: string;
    createdAt: string;
  };
  children: {
    active: number;
    boys: number;
    girls: number;
    /** Migratsiyadan oldin qo'shilgan bolalarda jins ko'rsatilmagan. */
    unknownGender: number;
    quarantined: number;
    inactive: number;
  };
  groups: {
    total: number;
    active: number;
    capacity: number;
    items: {
      id: string;
      name: string;
      capacity: number;
      status: GroupStatus;
      childrenCount: number;
      teachers: string[];
    }[];
  };
  employees: {
    total: number;
    active: number;
    withAccount: number;
    byPosition: { position: string; count: number }[];
  };
  finance: {
    monthRevenue: number;
    outstandingDebt: number;
    invoices: { status: InvoiceStatus; count: number; billed: number; paid: number }[];
  };
}

/* ------------------------------------------------------------------ */
/* Tarmoq bo'ylab moliya (Super Admin)                                 */
/* ------------------------------------------------------------------ */

interface MoneyBucket {
  billed: number;
  collected: number;
  outstanding: number;
}

/** `GET /app/finance/summary` javobi. Summalar — son, satr emas. */
export interface FinanceSummary {
  period: string;
  totals: MoneyBucket & { collectedInPeriod: number; invoiceCount: number };
  branches: (MoneyBucket & { branchId: string; branchName: string })[];
  groups: (MoneyBucket & {
    groupId: string | null;
    groupName: string;
    branchId: string | null;
    branchName: string;
  })[];
  statuses: { status: InvoiceStatus; count: number; billed: number; paid: number }[];
}

export type FinanceChildStatus = "PAID" | "PARTIAL" | "UNPAID";

/** `GET /app/finance/children` javobi. */
export interface FinanceChildren {
  period: string;
  counts: { total: number; paid: number; partial: number; unpaid: number };
  items: {
    childId: string;
    publicId: number;
    fullName: string;
    groupId: string | null;
    groupName: string | null;
    branchId: string;
    branchName: string;
    billed: number;
    paid: number;
    outstanding: number;
    status: FinanceChildStatus;
    dueDate: string | null;
    overdue: boolean;
  }[];
}

/** `GET /app/payroll/summary` javobi. */
export interface PayrollSummary {
  period: string | null;
  totals: { entries: number; base: number; bonus: number; penalty: number; total: number; paid: number; unpaid: number };
  branches: { branchId: string; branchName: string; entries: number; total: number; paid: number; unpaid: number }[];
}

/** `GET /app/groups/:id/attendance/day` javobi. */
export interface GroupAttendanceDay {
  date: string;
  total: number;
  counts: { present: number; absent: number; unmarked: number };
  items: {
    childId: string;
    publicId: number;
    fullName: string;
    gender: Gender | null;
    status: AttendanceStatus | null;
    note: string | null;
  }[];
}

/* ------------------------------------------------------------------ */
/* Ota-ona kabineti                                                    */
/* ------------------------------------------------------------------ */

export interface ParentAccount {
  id: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  fullName: string;
  phone: string;
}

export interface ParentChild {
  id: string;
  publicId: number;
  fullName: string;
  gender: Gender | null;
  birthDate: string | null;
  status: ChildStatus;
  avatarUpdatedAt: string | null;
  group: { id: string; name: string } | null;
  branch: { id: string; name: string };
  relation: GuardianRelation;
}

/** `GET /app/parent/children/:id/day` javobi. */
export interface ParentDay {
  date: string;
  child: { id: string; fullName: string; groupName: string | null; avatarUpdatedAt: string | null };
  attendance: { status: AttendanceStatus; note: string | null } | null;
  report: {
    eatingQuality: "GOOD" | "AVERAGE" | "POOR" | null;
    sleepMinutes: number | null;
    mood: "HAPPY" | "NEUTRAL" | "UPSET" | null;
    toiletNotes: string | null;
    activityNotes: string | null;
    updatedAt: string;
  } | null;
  menu: { breakfast: string | null; lunch: string | null; snack: string | null } | null;
}

export interface ParentAttendanceStrip {
  items: { date: string; status: AttendanceStatus | null }[];
  present: number;
  absent: number;
  marked: number;
}
