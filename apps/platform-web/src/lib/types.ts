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

export type OrganizationStatus = "ACTIVE" | "SUSPENDED";

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
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: OrganizationStatus;
  createdAt: string;
  branches: Branch[];
  subscription: Subscription | null;
  wallet: Wallet | null;
}

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
