export type PlatformUserRole = "PLATFORM_SUPER_ADMIN" | "PLATFORM_SUPPORT";

export interface AuthenticatedUser {
  id: string;
  login: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: PlatformUserRole;
}

export type OrganizationStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  timezone: string;
  currency: string;
  createdAt: string;
}

export type SubscriptionStatus = "ACTIVE" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";

export interface Plan {
  id: string;
  name: string;
  code: string;
  priceMonthly: string;
  currency: string;
  maxBranches: number;
  maxChildren: number;
  maxEmployees: number;
  maxStorageGb: number;
  features: Record<string, boolean>;
  isActive: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  graceUntil: string | null;
  /** Sinov muddati tugash sanasi; bo'sh — sinov emas. */
  trialEndsAt: string | null;
  plan?: Plan;
  organization?: Organization;
}

export interface Wallet {
  id: string;
  organizationId: string;
  balance: string;
  currency: string;
}

export type WalletTransactionType = "TOP_UP" | "SUBSCRIPTION_CHARGE" | "REFUND" | "BONUS" | "ADJUSTMENT";

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amount: string;
  balanceAfter: string;
  note: string | null;
  createdAt: string;
  createdByUser?: { id: string; fullName: string; login: string } | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  /** Mustaqil lending sayt domeni (masalan "vista-academy.uz"), protokolsiz. Shu domendan kelgan arizalar shu tashkilotga bog'lanadi. */
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: OrganizationStatus;
  /** To'xtatish sababi — bog'cha xodimlariga kirishda ko'rsatiladi. */
  suspendReason: string | null;
  suspendedAt: string | null;
  archivedAt: string | null;
  /** Operatorning ichki izohi (bog'chaga ko'rinmaydi). */
  notes: string | null;
  createdAt: string;
  branches: Branch[];
  subscription: Subscription | null;
  wallet: Wallet | null;
  /** Faqat ro'yxat javobida: faol bolalar va xodimlar soni (tarif limitiga nisbatan). */
  _count?: { children: number; employees: number };
}

export type OrganizationSort = "created" | "name" | "children" | "balance";

export type LandingScheduleType = "LESSON" | "SLEEP" | "MEAL" | "OTHER";

export interface LandingScheduleItem {
  id: string;
  time: string;
  title: string;
  type: LandingScheduleType;
  order: number;
}

export type LandingMealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER" | "OTHER";

export type LandingWeekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export interface LandingMeal {
  id: string;
  title: string;
  description: string | null;
  mealType: LandingMealType;
  weekday: LandingWeekday | null;
  time: string | null;
  photoPath: string | null;
  order: number;
}

export interface LandingTeacher {
  id: string;
  fullName: string;
  role: string;
  bio: string | null;
  photoPath: string | null;
  order: number;
}

export interface LandingContentBlock {
  id: string;
  key: string;
  title: string;
  body: string;
  photoPath: string | null;
}

export interface DashboardSummary {
  totalOrganizations: number;
  activeOrganizations: number;
  totalBranches: number;
  activeSubscriptions: number;
  graceSubscriptions: number;
  suspendedSubscriptions: number;
  totalWalletBalance: string;
  mrr: string;
  recentOrganizations: Organization[];
}

export type AnalyticsPeriod = "day" | "week" | "month" | "year";

export interface OrganizationRef {
  id: string;
  name: string;
  slug: string;
}

/** GET /platform/dashboard/analytics — pul qiymatlari son (so'm). */
export interface DashboardAnalytics {
  period: AnalyticsPeriod;
  range: { start: string; end: string };
  kpis: {
    revenue: { value: number; previous: number; changePct: number | null };
    activeChildren: { value: number; added: number; changePct: number | null };
    newOrganizations: { value: number; previous: number; changePct: number | null };
    mrr: { value: number; activeSubscriptions: number };
  };
  revenueByMonth: { month: string; total: number }[];
  subscriptions: { total: number; active: number; grace: number; suspended: number; cancelled: number; none: number };
  plans: { id: string; name: string; priceMonthly: number; subscribers: number }[];
  expiring: {
    organization: OrganizationRef;
    plan: { name: string; priceMonthly: number };
    status: SubscriptionStatus;
    periodEnd: string;
    graceUntil: string | null;
  }[];
  recentTransactions: {
    id: string;
    type: WalletTransactionType;
    amount: number;
    balanceAfter: number;
    note: string | null;
    createdAt: string;
    createdBy: string | null;
    organization: OrganizationRef;
  }[];
}

/** GET /platform/organizations/:id/usage */
export interface OrganizationUsage {
  plan: { name: string; maxBranches: number; maxChildren: number; maxEmployees: number; maxStorageGb: number } | null;
  counts: { branches: number; children: number; employees: number; staffAccounts: number; guardians: number; groups: number };
  branches: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    createdAt: string;
    children: number;
    employees: number;
    groups: number;
  }[];
  admins: { id: string; login: string; fullName: string; isActive: boolean; lastLoginAt: string | null }[];
  lastLoginAt: string | null;
}

/** GET /platform/billing/overview */
export interface BillingOverview {
  /** Serverda SUBSCRIPTION_BILLING_CRON=on — obunalar avtomatik yangilanadi. */
  autoRenew: boolean;
  month: { start: string; end: string };
  topUps: { amount: number; count: number };
  charges: { amount: number; count: number };
  walletBalance: number;
  upcomingWeek: { count: number; amount: number; insufficient: number };
  overdue: { grace: number; suspended: number; amount: number };
}

/** GET /platform/billing/renewals */
export interface BillingRenewal {
  organization: OrganizationRef & { status: OrganizationStatus };
  plan: { name: string; priceMonthly: number };
  status: SubscriptionStatus;
  periodEnd: string;
  graceUntil: string | null;
  trialEndsAt: string | null;
  balance: number;
  enough: boolean;
}

/** GET /platform/billing/transactions */
export interface BillingTransaction {
  id: string;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
  organization: OrganizationRef;
}
