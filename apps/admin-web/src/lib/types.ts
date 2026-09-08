export type TenantUserRole = "NETWORK_ADMIN" | "BRANCH_ADMIN" | "FINANCE" | "MANAGER";

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

export interface Group {
  id: string;
  branchId: string;
  name: string;
  capacity: number;
  status: GroupStatus;
  createdAt: string;
  _count?: { children: number };
}

export type ChildStatus = "ACTIVE" | "INACTIVE" | "QUARANTINED";

export interface Child {
  id: string;
  organizationId: string;
  branchId: string;
  groupId: string | null;
  fullName: string;
  birthDate: string | null;
  status: ChildStatus;
  quarantineUntil: string | null;
  quarantineReason: string | null;
  createdAt: string;
  group?: { id: string; name: string } | null;
  branch?: { id: string; name: string };
}

export interface Employee {
  id: string;
  organizationId: string;
  branchId: string;
  fullName: string;
  position: string;
  isActive: boolean;
  createdAt: string;
}

export type AttendanceStatus = "PRESENT" | "ABSENT";

export interface AttendanceChild {
  childId: string;
  fullName: string;
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
  guardian: Guardian;
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
