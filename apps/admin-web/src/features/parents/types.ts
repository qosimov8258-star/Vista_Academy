/** API: GET /app/parent-engagement va /app/parent-engagement/:id */

export type EngagementLevel = "ACTIVE" | "LOW" | "INACTIVE" | "UNCONNECTED";
export type GuardianRelation = "MOTHER" | "FATHER" | "GRANDPARENT" | "OTHER";

export interface EngagementChild {
  id: string;
  fullName: string;
  relation: GuardianRelation;
  groupName: string | null;
  branchName: string | null;
}

export interface EngagementGuardian {
  id: string;
  fullName: string;
  phone: string;
  connected: boolean;
  level: EngagementLevel;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  secondsToday: number;
  secondsWeek: number;
  secondsMonth: number;
  activeDays30: number;
  resultViews30: number;
  pushEnabled: boolean;
  unreadMessages: number;
  children: EngagementChild[];
}

export interface EngagementOverview {
  summary: {
    total: number;
    connected: number;
    activeToday: number;
    active7: number;
    active30: number;
    levels: Record<EngagementLevel, number>;
    pushEnabled: number;
    followingChild30: number;
    secondsToday: number;
    secondsWeek: number;
    secondsMonth: number;
    avgSecondsPerActiveWeek: number;
    messagesReceived30: number;
    messagesRead30: number;
  };
  daily: { date: string; guardians: number; seconds: number }[];
  pages: { page: string; views: number; seconds: number; guardians: number }[];
  guardians: EngagementGuardian[];
}

export interface GuardianEngagementDetail {
  guardian: {
    id: string;
    fullName: string;
    phone: string;
    connected: boolean;
    level: EngagementLevel;
    lastLoginAt: string | null;
    lastActivityAt: string | null;
    createdAt: string;
  };
  children: (EngagementChild & { publicId: number; receivesNotifications: boolean })[];
  stats: {
    secondsToday: number;
    secondsWeek: number;
    secondsMonth: number;
    activeDays30: number;
    visits30: number;
    avgVisitSeconds: number;
    resultViews30: number;
    lastResultViewAt: string | null;
  };
  daily: { date: string; seconds: number }[];
  hours: number[];
  pages: { page: string; views: number; seconds: number; lastAt: string }[];
  recent: { id: string; page: string; childName: string | null; startedAt: string; durationSec: number }[];
  devices: { userAgent: string | null; lastAt: string; logins: number }[];
  push: { userAgent: string | null; createdAt: string }[];
  messages: { unread: number; recent: { title: string; mandatory: boolean; sentAt: string; readAt: string | null }[] };
  receipts: { count90: number; lastAt: string | null };
}
