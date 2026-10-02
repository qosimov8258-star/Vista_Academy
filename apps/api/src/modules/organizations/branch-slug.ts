/**
 * Filial slug'i bog'cha panelida manzilning ikkinchi bo'lagi:
 * `/{orgSlug}/{branchSlug}/...` (subdomenda `/{branchSlug}/...`). Shuning
 * uchun u quyidagilar bilan bir xil bo'lmasligi kerak:
 *
 * - admin-web'dagi `/{orgSlug}/...` sahifalari (admin-web `proxy.ts`
 *   KNOWN_ORG_PAGES va `app/(dashboard)/[slug]/` papkalari) — aks holda
 *   filial havolasi o'sha sahifaga tushib qoladi;
 * - bog'chaning o'z slug'i — subdomenda `/{orgSlug}` eski uslubdagi havola
 *   deb bosh sahifaga yo'naltiriladi (vista-academy.zeeron.uz/vista-academy
 *   Super Adminni filial o'rniga bosh sahifaga olib ketardi).
 */
export const RESERVED_BRANCH_SLUGS = new Set([
  "login",
  "ota-ona",
  "api",
  "children",
  "groups",
  "employees",
  "attendance",
  "lesson-attendance",
  "staff-attendance",
  "nutrition",
  "cash",
  "debtors",
  "cash-report",
  "group-payments",
  "calls",
  "board",
  "pickups",
  "weekly-report",
  "staff-absences",
  "finance",
  "branches",
  "users",
  "crm",
  "hr",
  "notifications",
  "lessons",
  "my-lessons",
  "coin",
  "my-notifications",
  "settings",
  "useful",
  "lending",
  "face-id",
  "audit-logs",
  "daily-reports",
  "network",
  "reminders",
  "report",
]);

export function isUsableBranchSlug(candidate: string, organizationSlug: string): boolean {
  return candidate !== organizationSlug && !RESERVED_BRANCH_SLUGS.has(candidate);
}
